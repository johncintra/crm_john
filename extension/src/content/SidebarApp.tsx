import { useCallback, useEffect, useMemo, useState } from 'react';
import { Contact, LayoutPanelTop, ListTodo, MessageSquareText, UserCircle2, X } from 'lucide-react';
import { demoLeadContext } from './demo-data';
import { useBackground } from './hooks/useBackground';
import { useWhatsAppConversation } from './hooks/useWhatsAppConversation';
import { useWhatsAppConversationList } from './hooks/useWhatsAppConversationList';
import { copyToClipboard, formatCurrency, normalizePhone } from '../shared/utils';
import { savePendingMessageHistory, takePendingMessageHistory } from '../shared/storage';
import {
  getAllWhatsAppConversationList,
  forceOpenConversationByPhoneNumber,
  getCurrentConversationAvatar,
  getOpenConversationMessages,
  getRealContactPhoneNumber,
  getSelectedConversationFromList,
  openConversationByPhoneNumber,
  openConversationInWhatsApp
} from './whatsapp';
import type { AuthSession, CheckoutBoardData, LeadContext, RemoteLeadMessage, WorkspaceTag } from '../shared/types';
import {
  FunnelBoard,
  type FunnelCard,
  type FunnelColumn,
  type PinnedCardColumn
} from './components/FunnelBoard';
import { LoginScreen } from './components/LoginScreen';
import { MessageHistoryPanel } from './components/MessageHistoryPanel';
import { TagPicker } from './components/TagPicker';

type WorkspaceView = 'general' | 'funnel';
type RailPanel = 'account' | 'lead' | 'templates' | 'lists' | 'calendar';

const APPROVED_TAG_NAME = 'aprovado';
const hasApprovedTag = (card: FunnelCard) =>
  (card.tags ?? []).some((tag) => tag.name.trim().toLowerCase() === APPROVED_TAG_NAME);

interface SavedFunnel {
  id: string;
  name: string;
  columns: FunnelColumn[];
  cards: FunnelCard[];
}

const CHECKOUT_FUNNEL_ID = '__checkout_funnel__';
const CHECKOUT_FALLBACK_COLUMNS: FunnelColumn[] = [
  { id: 'checkout-fallback-boleto', name: 'Boleto Gerado', color: '#a78bfa' },
  { id: 'checkout-fallback-pix', name: 'Pix Gerado', color: '#06b6d4' },
  { id: 'checkout-fallback-abandoned', name: 'Carrinho Abandonado', color: '#94a3b8' },
  { id: 'checkout-fallback-declined', name: 'Compra Recusada', color: '#ef4444' },
  { id: 'checkout-fallback-refunded', name: 'Reembolso', color: '#f59e0b' },
  { id: 'checkout-fallback-chargeback', name: 'Chargeback', color: '#7c3aed' },
  { id: 'checkout-fallback-awaiting', name: 'Aguardando Compra', color: '#facc15' },
  { id: 'checkout-fallback-approved', name: 'Compra Aprovada', color: '#22c55e' }
];

export function SidebarApp() {
  const sendMessage = useBackground();
  const conversation = useWhatsAppConversation();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const isAuthenticated = Boolean(session?.token);
  const [context, setContext] = useState<LeadContext | null>(demoLeadContext);
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTag[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('funnel');
  const [railPanel, setRailPanel] = useState<RailPanel>('account');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [funnels, setFunnels] = useState<SavedFunnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [funnelsLoaded, setFunnelsLoaded] = useState(false);
  const [checkoutBoard, setCheckoutBoard] = useState<CheckoutBoardData | null>(null);
  const [messageHistory, setMessageHistory] = useState<RemoteLeadMessage[] | null>(null);
  const [messageHistoryLeadName, setMessageHistoryLeadName] = useState('');
  const isCheckoutFunnelSelected = selectedFunnelId === CHECKOUT_FUNNEL_ID;
  const conversations = useWhatsAppConversationList({
    scanAll: workspaceView === 'general' && !isCheckoutFunnelSelected
  });

  const selectedLocalFunnel = useMemo(() => {
    return funnels.find((funnel) => funnel.id === selectedFunnelId) ?? funnels[0] ?? null;
  }, [funnels, selectedFunnelId]);

  const checkoutColumns = useMemo<FunnelColumn[]>(() => {
    const columns = checkoutBoard?.columns?.length ? checkoutBoard.columns : CHECKOUT_FALLBACK_COLUMNS;

    return columns.map((column) => ({
      id: column.id,
      name: column.name,
      color: column.color ?? '#38bdf8'
    }));
  }, [checkoutBoard?.columns]);

  const checkoutCards = useMemo<FunnelCard[]>(() => {
    const fallbackColumnId = checkoutColumns[0]?.id ?? '';

    return (checkoutBoard?.cards ?? []).map((card) => ({
      id: card.id,
      leadId: card.leadId,
      name: card.name,
      email: card.email ?? null,
      phone: card.phone ?? card.normalizedPhone ?? null,
      normalizedPhone: card.normalizedPhone ?? null,
      avatarUrl: null,
      columnId: card.columnId ?? fallbackColumnId,
      source: card.source,
      temperature: card.temperature ?? null,
      wasCheckoutOpportunity: card.wasCheckoutOpportunity ?? false,
      tags: (card.tags ?? []).filter((tag) => {
        const normalizedName = tag.name.trim().toLowerCase();
        return normalizedName !== 'kiwify' && normalizedName !== 'hotmart';
      }),
      latestOrder: card.latestOrder
    }));
  }, [checkoutBoard?.cards, checkoutColumns]);

  // Pinned columns shown inside every regular CRM funnel — checkout leads
  // the seller can drag into their own stages without ever leaving the
  // checkout pipeline's own records (assign is pipeline-scoped, see
  // assignContactToStage on the backend).
  //
  // Both pinned columns hide any checkout lead already claimed into this
  // funnel (matched by phone or email) so the same person never shows up
  // twice — once approved, a lead the seller already pulled into a real
  // stage stops appearing in "Compra Aprovada" too, not just in
  // "Oportunidades".
  const dedupeAgainstLocalFunnel = useCallback(
    (sourceCards: FunnelCard[]) => {
      const localCards = selectedLocalFunnel?.cards ?? [];
      const claimedPhones = new Set(
        localCards
          .map((card) => card.normalizedPhone || (card.phone ? normalizePhone(card.phone) : null))
          .filter((value): value is string => Boolean(value))
      );
      const claimedEmails = new Set(
        localCards.map((card) => card.email?.trim().toLowerCase()).filter((value): value is string => Boolean(value))
      );

      return sourceCards.filter((card) => {
        const phoneKey = card.normalizedPhone || (card.phone ? normalizePhone(card.phone) : null);
        if (phoneKey && claimedPhones.has(phoneKey)) return false;
        const emailKey = card.email?.trim().toLowerCase();
        if (emailKey && claimedEmails.has(emailKey)) return false;
        return true;
      });
    },
    [selectedLocalFunnel]
  );

  const pinnedOpportunityColumns = useMemo<PinnedCardColumn[]>(() => {
    const opportunities = checkoutCards.filter((card) => card.latestOrder?.status !== 'APPROVED');
    return [{ id: 'pinned-oportunidades', title: 'Oportunidades', color: '#38bdf8', cards: dedupeAgainstLocalFunnel(opportunities) }];
  }, [checkoutCards, dedupeAgainstLocalFunnel]);

  // Manually tagging a regular CRM card "aprovado" promotes it into the
  // pinned Compra Aprovada column too — the card's real stage never
  // changes, so removing/swapping the tag puts it right back where it was
  // (see hasApprovedTag filtering boardCardsRaw below).
  const pinnedApprovedColumns = useMemo<PinnedCardColumn[]>(() => {
    // Only leads that were ever visible as an Oportunidade (or already
    // claimed into a regular CRM stage, handled by the dedupe below) count
    // here — renewals and launch sales that arrive already approved on
    // their first-ever webhook never passed through the seller's funnel,
    // so they don't belong in this column.
    const approvedFromCheckout = dedupeAgainstLocalFunnel(
      checkoutCards.filter((card) => card.latestOrder?.status === 'APPROVED' && card.wasCheckoutOpportunity)
    );
    const approvedFromLocalFunnel = !isCheckoutFunnelSelected
      ? (selectedLocalFunnel?.cards ?? []).filter(hasApprovedTag).map((card) => ({ ...card, pinnedViaTag: true }))
      : [];
    return [
      {
        id: 'pinned-compra-aprovada',
        title: 'Compra Aprovada',
        color: '#22c55e',
        cards: [...approvedFromCheckout, ...approvedFromLocalFunnel]
      }
    ];
  }, [checkoutCards, dedupeAgainstLocalFunnel, isCheckoutFunnelSelected, selectedLocalFunnel]);

  const allFunnels = useMemo(() => {
    return [
      ...funnels.map((funnel) => ({ id: funnel.id, name: funnel.name })),
      {
        id: CHECKOUT_FUNNEL_ID,
        name: checkoutBoard?.funnel.name ?? 'Checkout'
      }
    ];
  }, [checkoutBoard?.funnel.name, funnels]);

  const assignableFunnels = useMemo(() => funnels.map((funnel) => ({ id: funnel.id, name: funnel.name })), [funnels]);

  const boardColumns = isCheckoutFunnelSelected
    ? checkoutColumns
    : selectedLocalFunnel?.columns ?? [];
  // A card tagged "aprovado" is shown in the pinned Compra Aprovada column
  // instead of its own stage (see pinnedApprovedColumns) — its real stage
  // is untouched, so it reappears here the moment the tag is removed.
  const boardCardsRaw = isCheckoutFunnelSelected
    ? checkoutCards
    : (selectedLocalFunnel?.cards ?? []).filter((card) => !hasApprovedTag(card));
  const boardCards = useMemo(() => {
    if (!conversations.length) return boardCardsRaw;
    return boardCardsRaw.map((card) => {
      if (card.avatarUrl) return card;
      const normalizedCardPhone = card.phone ? normalizePhone(card.phone) : null;
      const normalizedCardName = card.name.trim().toLowerCase();
      const match =
        (normalizedCardPhone
          ? conversations.find((item) => item.phone && normalizePhone(item.phone) === normalizedCardPhone)
          : null) ?? conversations.find((item) => item.name.trim().toLowerCase() === normalizedCardName);
      return match?.avatarUrl ? { ...card, avatarUrl: match.avatarUrl } : card;
    });
  }, [boardCardsRaw, conversations]);

  const selectedConversationListItem = useMemo(
    () => getSelectedConversationFromList(),
    [conversation.label, conversation.phone]
  );

  const safeConversationLabel = useMemo(() => {
    const label = (conversation.label ?? '').trim();
    if (!label) {
      return null;
    }

    const blockedLabels = new Set([
      'dados do perfil',
      'profile details',
      'info do contato',
      'contact info',
      'informacoes do contato',
      'informações do contato'
    ]);

    return blockedLabels.has(label.toLowerCase()) ? null : label;
  }, [conversation.label]);

  const currentConversationListItem = useMemo(() => {
    if (selectedConversationListItem) {
      return selectedConversationListItem;
    }

    if (!conversation.phone && !safeConversationLabel) {
      return null;
    }

    return (
      conversations.find((item) => {
        if (conversation.phone && item.phone && conversation.phone === item.phone) {
          return true;
        }

        if (safeConversationLabel && item.name === safeConversationLabel) {
          return true;
        }

        return false;
      }) ?? null
    );
  }, [conversation.phone, conversations, safeConversationLabel, selectedConversationListItem]);

  const activeConversationCard = useMemo(() => {
    return (
      boardCards.find((card) => {
        if (context?.lead?.id && card.leadId === context.lead.id) {
          return true;
        }

        if (
          currentConversationListItem?.phone &&
          card.phone &&
          currentConversationListItem.phone === card.phone
        ) {
          return true;
        }

        if (currentConversationListItem?.name && card.name === currentConversationListItem.name) {
          return true;
        }

        if (conversation.phone && card.phone && conversation.phone === card.phone) {
          return true;
        }

        if (safeConversationLabel && card.name === safeConversationLabel) {
          return true;
        }

        return false;
      }) ?? null
    );
  }, [boardCards, context?.lead?.id, conversation.phone, currentConversationListItem, safeConversationLabel]);

  const loadCheckoutBoard = useCallback(async () => {
    try {
      const data = await sendMessage<CheckoutBoardData>({ type: 'checkout:fetch-board' });
      setCheckoutBoard(data);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Falha ao carregar o funil Checkout.');
    }
  }, [sendMessage]);

  const refreshLeadContext = useCallback(async () => {
    if (!conversation.phone) {
      setContext(demoLeadContext);
      return;
    }

    try {
      const data = await sendMessage<LeadContext | null>({
        type: 'lead:fetch-context',
        payload: { phone: conversation.phone }
      });
      setContext(data);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Falha ao carregar lead.');
    }
  }, [conversation.phone, sendMessage]);

  useEffect(() => {
    void (async () => {
      try {
        const currentSession = await sendMessage<AuthSession>({ type: 'auth:get-session' });
        setSession(currentSession);
      } catch {
        setSession(null);
        setContext(demoLeadContext);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [sendMessage]);

  const handleLogin = async (email: string, password: string) => {
    const nextSession = await sendMessage<AuthSession>({
      type: 'auth:login',
      payload: { email, password }
    });
    setSession(nextSession);
  };

  const handleLogout = async () => {
    await sendMessage({ type: 'auth:logout' });
    setSession(null);
    setFunnels([]);
    setSelectedFunnelId('');
    setFunnelsLoaded(false);
    setCheckoutBoard(null);
    setContext(demoLeadContext);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshLeadContext();
  }, [refreshLeadContext, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void sendMessage<WorkspaceTag[]>({ type: 'workspace:fetch-tags' })
      .then((tags) => setWorkspaceTags(tags))
      .catch(() => undefined);
  }, [isAuthenticated]);

  // Restore the "conversa recente" panel after opening a brand-new chat by
  // phone caused a full page reload (the only reliable way to open a chat
  // with zero prior history on this WhatsApp number).
  useEffect(() => {
    if (!isAuthenticated) return;

    void takePendingMessageHistory().then((pending) => {
      if (!pending) return;
      void sendMessage<RemoteLeadMessage[]>({
        type: 'lead:fetch-messages',
        payload: { leadId: pending.leadId, hours: 24 }
      })
        .then((history) => {
          setMessageHistoryLeadName(pending.name);
          setMessageHistory(history);
        })
        .catch(() => {});
    });
  }, [isAuthenticated, sendMessage]);

  // While a conversation tied to a known lead is open, periodically scrape
  // the visible messages and sync the last 24h to the backend, so the
  // conversation can be recovered from a different WhatsApp number later.
  useEffect(() => {
    if (!isAuthenticated || !context?.lead?.id) return;
    const leadId = context.lead.id;
    const sinceMs = Date.now() - 24 * 60 * 60 * 1000;

    const sync = () => {
      const messages = getOpenConversationMessages(sinceMs);
      if (!messages.length) return;
      void sendMessage({ type: 'lead:sync-messages', payload: { leadId, messages } }).catch(() => {});
    };

    sync();
    const interval = window.setInterval(sync, 10000);
    return () => window.clearInterval(interval);
  }, [context?.lead?.id, isAuthenticated, sendMessage]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadCheckoutBoard();
  }, [loadCheckoutBoard, isAuthenticated]);

  useEffect(() => {
    if (selectedFunnelId === CHECKOUT_FUNNEL_ID) {
      void loadCheckoutBoard();
    }
  }, [loadCheckoutBoard, selectedFunnelId]);

  useEffect(() => {
    // Keep checkout data fresh while viewing any funnel in the general
    // board, not just the checkout funnel itself — the pinned
    // "Oportunidades"/"Compra Aprovada" columns on regular funnels depend
    // on it too.
    if (workspaceView !== 'general') {
      return;
    }

    const interval = window.setInterval(() => {
      void loadCheckoutBoard();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadCheckoutBoard, workspaceView]);

  const loadFunnels = useCallback(async () => {
    try {
      const pipelines = await sendMessage<Array<{ id: string; name: string; isDefault: boolean; columns: Array<{ id: string; name: string; color: string }> }>>({ type: 'pipeline:fetch-list' });
      if (!pipelines.length) {
        const created = await sendMessage<{ id: string; name: string }>({ type: 'pipeline:create', payload: { name: 'CRM General (Funil Principal)' } });
        setFunnels([{ id: created.id, name: created.name, columns: [], cards: [] }]);
        setSelectedFunnelId(created.id);
      } else {
        setFunnels(pipelines.map((p) => ({ id: p.id, name: p.name, columns: p.columns.map((c) => ({ id: c.id, name: c.name, color: c.color })), cards: [] })));
        setSelectedFunnelId(pipelines[0].id);
      }
    } catch {
      const fallback: SavedFunnel = { id: `funnel-${Date.now()}`, name: 'CRM General (Funil Principal)', columns: [], cards: [] };
      setFunnels([fallback]);
      setSelectedFunnelId(fallback.id);
    } finally {
      setFunnelsLoaded(true);
    }
  }, [sendMessage]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadFunnels();
  }, [loadFunnels, isAuthenticated]);

  const loadFunnelBoard = useCallback(async (pipelineId: string) => {
    try {
      const board = await sendMessage<{ funnel: { id: string; name: string }; columns: Array<{ id: string; name: string; color: string }>; cards: Array<{ id: string; leadId: string; name: string; email?: string | null; phone?: string | null; normalizedPhone?: string | null; avatarUrl: null; columnId: string | null; source?: string | null; temperature?: string | null; tags: Array<{ id: string; name: string; color?: string | null }>; latestOrder: unknown }> }>({ type: 'pipeline:fetch-board', payload: { id: pipelineId } });
      setFunnels((prev) => prev.map((f) => f.id !== pipelineId ? f : {
        ...f,
        name: board.funnel.name,
        columns: board.columns.map((c) => ({ id: c.id, name: c.name, color: c.color })),
        cards: board.cards.map((c) => ({ id: c.id, leadId: c.leadId, name: c.name, email: c.email ?? null, phone: c.phone ?? c.normalizedPhone ?? null, normalizedPhone: c.normalizedPhone ?? null, avatarUrl: null, columnId: c.columnId ?? f.columns[0]?.id ?? '', source: c.source ?? null, temperature: c.temperature ?? null, tags: c.tags, latestOrder: c.latestOrder as FunnelCard['latestOrder'] }))
      }));
    } catch { /* keep existing state on error */ }
  }, [sendMessage]);

  useEffect(() => {
    if (!funnelsLoaded || !selectedFunnelId || selectedFunnelId === CHECKOUT_FUNNEL_ID) return;
    void loadFunnelBoard(selectedFunnelId);
  }, [funnelsLoaded, selectedFunnelId, loadFunnelBoard]);

  useEffect(() => {
    if (!selectedFunnelId && funnels[0]) {
      setSelectedFunnelId(funnels[0].id);
      return;
    }

    if (
      selectedFunnelId &&
      selectedFunnelId !== CHECKOUT_FUNNEL_ID &&
      !funnels.some((funnel) => funnel.id === selectedFunnelId) &&
      funnels[0]
    ) {
      setSelectedFunnelId(funnels[0].id);
    }
  }, [funnels, selectedFunnelId]);

  useEffect(() => {
    if (workspaceView !== 'funnel') {
      return;
    }

    if (selectedFunnelId !== CHECKOUT_FUNNEL_ID) {
      return;
    }

    if (selectedLocalFunnel) {
      setSelectedFunnelId(selectedLocalFunnel.id);
      return;
    }

    if (funnels[0]) {
      setSelectedFunnelId(funnels[0].id);
    }
  }, [funnels, selectedFunnelId, selectedLocalFunnel, workspaceView]);

  useEffect(() => {
    if (
      isCheckoutFunnelSelected ||
      !selectedLocalFunnel ||
      selectedLocalFunnel.columns.length ||
      !context?.pipeline?.stages?.length
    ) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedLocalFunnel.id
          ? {
              ...funnel,
              columns: [
                {
                  id: `column-${Date.now()}`,
                  name: context.pipeline?.stages[0]?.name ?? 'Etapa inicial',
                  color: context.pipeline?.stages[0]?.color ?? '#047515'
                }
              ]
            }
          : funnel
      )
    );
  }, [context?.pipeline?.stages, isCheckoutFunnelSelected, selectedLocalFunnel]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    document.body.classList.add('crm-john-with-rail', 'crm-john-with-toolbar', 'crm-john-with-stagebar');
    document.body.classList.toggle('crm-john-funnel-open', workspaceView === 'general');
    document.body.classList.toggle('crm-john-rail-hidden', workspaceView === 'general');
    document.body.classList.toggle('crm-john-rail-open', workspaceView !== 'general' && isRailOpen);

    return () => {
      document.body.classList.remove(
        'crm-john-with-rail',
        'crm-john-with-toolbar',
        'crm-john-with-stagebar',
        'crm-john-funnel-open',
        'crm-john-rail-hidden',
        'crm-john-rail-open'
      );
    };
  }, [isRailOpen, workspaceView]);

  const toggleRailPanel = (panel: RailPanel) => {
    if (railPanel === panel && isRailOpen) {
      setIsRailOpen(false);
      return;
    }

    setRailPanel(panel);
    setIsRailOpen(true);
  };

  const handleOpenConversation = async ({
    phone,
    normalizedPhone,
    name,
    leadId
  }: {
    name: string;
    phone: string | null;
    normalizedPhone?: string | null;
    leadId?: string;
  }) => {
    const normalizedCardPhone = phone ? normalizePhone(phone) : normalizedPhone ? normalizePhone(normalizedPhone) : null;
    const normalizedCardName = name.trim().toLowerCase();
    const matchedConversation =
      (normalizedCardPhone
        ? conversations.find((item) => item.phone && normalizePhone(item.phone) === normalizedCardPhone)
        : null) ??
      conversations.find((item) => item.name === name) ??
      conversations.find((item) => item.name.trim().toLowerCase() === normalizedCardName) ??
      conversations.find((item) => {
        const normalizedConversationName = item.name.trim().toLowerCase();
        return (
          normalizedConversationName.includes(normalizedCardName) ||
          normalizedCardName.includes(normalizedConversationName)
        );
      }) ??
      null;

    let conversationMatch = matchedConversation;
    const resolvedPhone = phone ?? normalizedPhone ?? matchedConversation?.phone ?? null;

    // Checkout leads are freshly-bought customers who essentially never
    // have prior chat history on this number — the full scan below would
    // never find them, so skip its ~7s scroll-through-everything cost and
    // go straight to the reliable phone-deep-link fallback further down.
    if (resolvedPhone && !conversationMatch && !isCheckoutFunnelSelected) {
      const allConversations = await getAllWhatsAppConversationList();
      conversationMatch =
        allConversations.find(
          (item) => item.phone && normalizePhone(item.phone) === normalizePhone(resolvedPhone)
        ) ??
        allConversations.find((item) => item.name.trim().toLowerCase() === normalizedCardName) ??
        null;
    }

    const finalPhone = resolvedPhone ?? conversationMatch?.phone ?? null;
    const finalName = conversationMatch?.name ?? name;

    let opened = await openConversationInWhatsApp(finalPhone ?? '', finalName);

    // openConversationByPhoneNumber's soft navigation only has a real
    // chance of being picked up when this account already has some trace
    // of the contact (conversationMatch) — for a genuinely new contact it
    // reliably fails after ~3s of retries, just delaying the fallback
    // below. Skip straight to the reliable path in that case.
    if (!opened && finalPhone && conversationMatch) {
      opened = await openConversationByPhoneNumber(finalPhone);
      if (opened) {
        setToast('Abrindo conversa por numero.');
      }
    }

    // Real phone known but no match in this WhatsApp account's own chat
    // list/search (e.g. the seller switched to a different number) — open a
    // brand new chat by phone via WhatsApp's universal deep link. This is a
    // full page reload (the only reliable way WhatsApp Web opens a chat it
    // has zero history with), so save the history lookup for after reload
    // and skip the rest of this render entirely.
    if (!opened && finalPhone && !conversationMatch) {
      if (leadId) {
        await savePendingMessageHistory({ leadId, name });
      }
      if (forceOpenConversationByPhoneNumber(finalPhone)) {
        return;
      }
    }

    if (opened) {
      setWorkspaceView('funnel');
    }

    if (opened && leadId && !phone) {
      void getRealContactPhoneNumber().then((capturedPhone) => {
        if (!capturedPhone) return;
        setToast(`Telefone capturado: ${capturedPhone}`);
        void sendMessage({ type: 'lead:update-phone', payload: { leadId, phone: capturedPhone } }).catch(() => {});
      });
    }

    if (!opened) {
      setToast(
        finalPhone
          ? 'Nao consegui focar ou iniciar a conversa automaticamente.'
          : 'Telefone real desse contato ainda nao foi capturado. Abra a conversa com ele no numero original para habilitar.'
      );
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await copyToClipboard(email);
      setToast('Email copiado.');
    } catch {
      setToast('Nao consegui copiar o email.');
    }
  };

  const handleUpdateCardEmail = (leadId: string, email: string) => {
    setFunnels((prev) => prev.map((f) => ({
      ...f,
      cards: f.cards.map((c) => (c.leadId === leadId ? { ...c, email } : c))
    })));
    setContext((prev) => (prev && prev.lead.id === leadId ? { ...prev, lead: { ...prev.lead, email } } : prev));
    void sendMessage({ type: 'lead:update-email', payload: { leadId, email } })
      .then(() => setToast('Email atualizado.'))
      .catch(() => setToast('Erro ao salvar email no servidor.'));
  };

  const handleAddCardTag = (leadId: string, name: string) => {
    void sendMessage<{ id: string; name: string; color: string | null }>({ type: 'lead:add-tag', payload: { leadId, name } })
      .then((tag) => {
        setFunnels((prev) => prev.map((f) => ({
          ...f,
          cards: f.cards.map((c) => {
            if (c.leadId !== leadId) return c;
            if ((c.tags ?? []).some((t) => t.id === tag.id)) return c;
            return { ...c, tags: [...(c.tags ?? []), tag] };
          })
        })));
        setContext((prev) => {
          if (!prev || prev.lead.id !== leadId) return prev;
          if ((prev.lead.tags ?? []).some((t) => t.id === tag.id)) return prev;
          return { ...prev, lead: { ...prev.lead, tags: [...(prev.lead.tags ?? []), tag] } };
        });
        setWorkspaceTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
        setToast('Tag adicionada.');
      })
      .catch(() => setToast('Erro ao adicionar tag.'));
  };

  const handleRemoveCardTag = (leadId: string, tagId: string) => {
    setFunnels((prev) => prev.map((f) => ({
      ...f,
      cards: f.cards.map((c) => (c.leadId === leadId ? { ...c, tags: (c.tags ?? []).filter((t) => t.id !== tagId) } : c))
    })));
    setContext((prev) => (prev && prev.lead.id === leadId
      ? { ...prev, lead: { ...prev.lead, tags: (prev.lead.tags ?? []).filter((t) => t.id !== tagId) } }
      : prev));
    void sendMessage({ type: 'lead:remove-tag', payload: { leadId, tagId } })
      .catch(() => setToast('Erro ao remover tag no servidor.'));
  };

  const handleUpdateCardValue = (leadId: string, amount: number, productName?: string) => {
    setFunnels((prev) => prev.map((f) => ({
      ...f,
      cards: f.cards.map((c) =>
        c.leadId === leadId
          ? { ...c, latestOrder: { id: c.latestOrder?.id ?? 'snapshot', amount, currency: 'BRL', productName: productName ?? c.latestOrder?.productName ?? '', status: c.latestOrder?.status ?? 'OPEN', provider: c.latestOrder?.provider ?? 'KIWIFY' } }
          : c
      )
    })));
    setContext((prev) => (prev && prev.lead.id === leadId
      ? { ...prev, lead: { ...prev.lead, latestOrder: { id: prev.lead.latestOrder?.id ?? 'snapshot', amount, currency: 'BRL', productName: productName ?? prev.lead.latestOrder?.productName ?? '', status: prev.lead.latestOrder?.status ?? 'OPEN' } } }
      : prev));
    void sendMessage({ type: 'lead:update-value', payload: { leadId, amount, currency: 'BRL', productName } })
      .then(() => setToast('Valor atualizado.'))
      .catch(() => setToast('Erro ao salvar valor no servidor.'));
  };

  const handleCreateColumn = ({ name, color }: { name: string; color: string }) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) return;
    const tempId = `column-${Date.now()}`;
    setFunnels((prev) => prev.map((f) => f.id !== selectedLocalFunnel.id ? f : { ...f, columns: [...f.columns, { id: tempId, name, color }] }));
    void sendMessage<{ id: string }>({ type: 'pipeline:create-stage', payload: { pipelineId: selectedLocalFunnel.id, name, color } })
      .then((stage) => {
        setFunnels((prev) => prev.map((f) => f.id !== selectedLocalFunnel.id ? f : { ...f, columns: f.columns.map((c) => c.id === tempId ? { ...c, id: stage.id } : c) }));
      })
      .catch(() => setToast('Erro ao salvar etapa no servidor.'));
    setToast('Nova etapa criada.');
  };

  const handleUpdateColumn = ({ id, name, color }: { id: string; name: string; color: string }) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) return;
    setFunnels((prev) => prev.map((f) => f.id !== selectedLocalFunnel.id ? f : { ...f, columns: f.columns.map((c) => c.id === id ? { ...c, name, color } : c) }));
    void sendMessage({ type: 'pipeline:update-stage', payload: { pipelineId: selectedLocalFunnel.id, stageId: id, name, color } })
      .catch(() => setToast('Erro ao atualizar etapa no servidor.'));
    setToast('Etapa atualizada.');
  };

  const handleDeleteColumn = (columnId: string) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) return;
    setFunnels((prev) => prev.map((f) => f.id !== selectedLocalFunnel.id ? f : { ...f, columns: f.columns.filter((c) => c.id !== columnId), cards: f.cards.filter((card) => card.columnId !== columnId) }));
    void sendMessage({ type: 'pipeline:delete-stage', payload: { pipelineId: selectedLocalFunnel.id, stageId: columnId } })
      .catch(() => setToast('Erro ao remover etapa no servidor.'));
    setToast('Etapa removida.');
  };

  const handleAssignConversation = async (conversationItem: (typeof conversations)[number], columnId: string) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) return;
    const tempId = `card-${Date.now()}-${conversationItem.id}`;
    let phone = conversationItem.phone;

    if (!phone) {
      // Capturing the real phone requires that contact's conversation to be
      // the one currently open (the contact-info panel belongs to whatever
      // chat is active). Open it first if it isn't already, instead of only
      // capturing when the seller happened to already be looking at it.
      const isAlreadyActive = currentConversationListItem?.id === conversationItem.id;
      const opened = isAlreadyActive || (await openConversationInWhatsApp(conversationItem.phone ?? '', conversationItem.name));

      if (opened) {
        if (!isAlreadyActive) {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
        }
        phone = await getRealContactPhoneNumber();
        if (phone) {
          setToast(`Telefone capturado: ${phone}`);
        }
      }
    }

    setFunnels((prev) => prev.map((f) => {
      if (f.id !== selectedLocalFunnel.id) return f;
      const existing = f.cards.find((c) => (c.phone && phone && normalizePhone(c.phone) === normalizePhone(phone)) || c.name === conversationItem.name);
      if (existing) {
        return { ...f, cards: f.cards.map((c) => c.id === existing.id ? { ...c, columnId, name: conversationItem.name, phone, normalizedPhone: phone ? normalizePhone(phone) : c.normalizedPhone, avatarUrl: conversationItem.avatarUrl } : c) };
      }
      return { ...f, cards: [...f.cards, { id: tempId, name: conversationItem.name, phone, normalizedPhone: phone ? normalizePhone(phone) : null, avatarUrl: conversationItem.avatarUrl, columnId }] };
    }));
    void sendMessage<{ id: string; leadId: string }>({ type: 'pipeline:assign-contact', payload: { pipelineId: selectedLocalFunnel.id, stageId: columnId, name: conversationItem.name, phone } })
      .then((card) => {
        setFunnels((prev) => prev.map((f) => f.id !== selectedLocalFunnel.id ? f : {
          ...f,
          cards: f.cards.map((c) =>
            c.id === tempId || c.name === conversationItem.name
              ? { ...c, id: card.id, leadId: card.leadId }
              : c
          )
        }));
      })
      .catch(() => setToast('Erro ao salvar contato no servidor.'));
    setToast('Lead enviado para a etapa.');
  };

  // Drag-assign from the pinned "Oportunidades"/"Compra Aprovada" columns
  // (checkout-sourced cards) into a stage of the currently selected regular
  // funnel. Always has a real phone already (checkout requires it), so —
  // unlike handleAssignConversation — there's no need to open WhatsApp to
  // capture it first. The checkout pipeline's own lead record is untouched
  // (assignContactToStage is scoped to the destination pipeline).
  const handleAssignPinnedCard = async (pinnedCard: FunnelCard, columnId: string) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) return;
    const tempId = `card-${Date.now()}-${pinnedCard.id}`;
    const phone = pinnedCard.phone;

    setFunnels((prev) => prev.map((f) => {
      if (f.id !== selectedLocalFunnel.id) return f;
      const existing = f.cards.find((c) => (c.phone && phone && normalizePhone(c.phone) === normalizePhone(phone)) || c.name === pinnedCard.name);
      if (existing) {
        return {
          ...f,
          cards: f.cards.map((c) =>
            c.id === existing.id
              ? {
                  ...c,
                  columnId,
                  name: pinnedCard.name,
                  phone,
                  email: pinnedCard.email,
                  normalizedPhone: phone ? normalizePhone(phone) : c.normalizedPhone,
                  avatarUrl: pinnedCard.avatarUrl,
                  tags: pinnedCard.tags,
                  latestOrder: pinnedCard.latestOrder
                }
              : c
          )
        };
      }
      return {
        ...f,
        cards: [
          ...f.cards,
          {
            id: tempId,
            name: pinnedCard.name,
            phone,
            email: pinnedCard.email,
            normalizedPhone: phone ? normalizePhone(phone) : null,
            avatarUrl: pinnedCard.avatarUrl,
            columnId,
            tags: pinnedCard.tags,
            latestOrder: pinnedCard.latestOrder
          }
        ]
      };
    }));
    void sendMessage<{ id: string; leadId: string; tags: FunnelCard['tags']; latestOrder: FunnelCard['latestOrder'] }>({
      type: 'pipeline:assign-contact',
      payload: {
        pipelineId: selectedLocalFunnel.id,
        stageId: columnId,
        name: pinnedCard.name,
        phone,
        email: pinnedCard.email,
        tagIds: pinnedCard.tags?.map((tag) => tag.id),
        originAmount: pinnedCard.latestOrder?.amount,
        originCurrency: pinnedCard.latestOrder?.currency,
        originProductName: pinnedCard.latestOrder?.productName,
        originOrderStatus: pinnedCard.latestOrder?.status
      }
    })
      .then((card) => {
        setFunnels((prev) => prev.map((f) => f.id !== selectedLocalFunnel.id ? f : {
          ...f,
          cards: f.cards.map((c) =>
            c.id === tempId || c.name === pinnedCard.name
              ? { ...c, id: card.id, leadId: card.leadId, tags: card.tags, latestOrder: card.latestOrder }
              : c
          )
        }));
      })
      .catch(() => setToast('Erro ao salvar contato no servidor.'));
    setToast('Lead enviado para a etapa.');
  };

  const handleMoveCard = async (cardId: string, columnId: string) => {
    if (isCheckoutFunnelSelected) {
      const checkoutCard = checkoutCards.find(
        (card) => card.id === cardId || (card.leadId && card.leadId === cardId)
      );
      const leadId = checkoutCard?.leadId ?? cardId;

      try {
        await sendMessage<void>({
          type: 'lead:update-stage',
          payload: { leadId, stageId: columnId }
        });
        await loadCheckoutBoard();
        if (context?.lead?.id === leadId) {
          await refreshLeadContext();
        }
        setToast('Lead movido no Checkout.');
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Nao consegui mover o lead.');
      }
      return;
    }

    if (!selectedLocalFunnel) {
      return;
    }

    const card = selectedLocalFunnel.cards.find((c) => c.id === cardId);
    const leadId = card?.leadId ?? cardId;
    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedLocalFunnel.id
          ? { ...funnel, cards: funnel.cards.map((c) => (c.id === cardId ? { ...c, columnId } : c)) }
          : funnel
      )
    );
    void sendMessage({ type: 'pipeline:move-card', payload: { pipelineId: selectedLocalFunnel.id, leadId, stageId: columnId } })
      .catch(() => setToast('Erro ao mover card no servidor.'));
    setToast('Card movido no funil.');
  };

  const handleMoveCurrentConversationToColumn = async (columnId: string) => {
    if (isCheckoutFunnelSelected) {
      const leadId = context?.lead?.id ?? activeConversationCard?.leadId;
      if (!leadId) {
        setToast('Esse contato ainda nao existe no funil Checkout.');
        return;
      }

      void handleMoveCard(leadId, columnId);
      return;
    }

    if (!selectedLocalFunnel || (!conversation.phone && !safeConversationLabel && !currentConversationListItem)) {
      return;
    }

    if (activeConversationCard) {
      if (!activeConversationCard.phone && activeConversationCard.leadId) {
        const capturedPhone = await getRealContactPhoneNumber();
        if (capturedPhone) {
          const normalizedCapturedPhone = normalizePhone(capturedPhone);
          setFunnels((previous) =>
            previous.map((funnel) =>
              funnel.id === selectedLocalFunnel.id
                ? {
                    ...funnel,
                    cards: funnel.cards.map((card) =>
                      card.id === activeConversationCard.id
                        ? { ...card, phone: capturedPhone, normalizedPhone: normalizedCapturedPhone }
                        : card
                    )
                  }
                : funnel
            )
          );
          void sendMessage({
            type: 'lead:update-phone',
            payload: { leadId: activeConversationCard.leadId, phone: capturedPhone }
          }).catch(() => {});
          setToast(`Telefone capturado: ${capturedPhone}`);
        }
      }

      void handleMoveCard(activeConversationCard.id, columnId);
      return;
    }

    if (currentConversationListItem) {
      handleAssignConversation(currentConversationListItem, columnId);
      return;
    }

    handleAssignConversation(
      {
        id: `current-${conversation.phone ?? conversation.label ?? Date.now()}`,
        name: safeConversationLabel ?? conversation.phone ?? 'Conversa atual',
        phone: conversation.phone,
        avatarUrl: getCurrentConversationAvatar()
      },
      columnId
    );
  };

  const handleRemoveCard = (cardId: string) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) return;
    const card = selectedLocalFunnel.cards.find((c) => c.id === cardId);
    const leadId = card?.leadId ?? cardId;
    setFunnels((previous) => previous.map((f) => f.id !== selectedLocalFunnel.id ? f : { ...f, cards: f.cards.filter((c) => c.id !== cardId) }));
    void sendMessage({ type: 'pipeline:remove-card', payload: { pipelineId: selectedLocalFunnel.id, leadId } })
      .catch(() => setToast('Erro ao remover card no servidor.'));
    setToast('Contato removido da etapa.');
  };

  const handleReorderColumns = (columnId: string, targetColumnId: string) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) return;
    setFunnels((previous) => previous.map((funnel) => {
      if (funnel.id !== selectedLocalFunnel.id) return funnel;
      const fromIndex = funnel.columns.findIndex((c) => c.id === columnId);
      const targetIndex = funnel.columns.findIndex((c) => c.id === targetColumnId);
      if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) return funnel;
      const nextColumns = [...funnel.columns];
      const [movedColumn] = nextColumns.splice(fromIndex, 1);
      nextColumns.splice(targetIndex, 0, movedColumn);
      return { ...funnel, columns: nextColumns };
    }));
    void sendMessage({ type: 'pipeline:reorder-stages', payload: { pipelineId: selectedLocalFunnel.id, stageId: columnId, targetStageId: targetColumnId } })
      .catch(() => setToast('Erro ao reordenar etapas no servidor.'));
    setToast('Etapas reorganizadas.');
  };

  const handleCreateFunnel = () => {
    const name = window.prompt('Nome do novo funil:', `Novo Funil ${funnels.length + 1}`)?.trim();
    if (!name) return;
    void sendMessage<{ id: string; name: string }>({ type: 'pipeline:create', payload: { name } })
      .then((created) => {
        setFunnels((previous) => [...previous, { id: created.id, name: created.name, columns: [], cards: [] }]);
        setSelectedFunnelId(created.id);
        setToast('Novo funil criado.');
      })
      .catch(() => setToast('Erro ao criar funil.'));
  };

  const handleConfigureFunnel = () => {
    if (isCheckoutFunnelSelected) {
      setToast('O funil Checkout sera configurado automaticamente pelos webhooks.');
      return;
    }

    if (!selectedLocalFunnel) {
      return;
    }

    const name = window.prompt('Nome do funil:', selectedLocalFunnel.name)?.trim();
    if (!name) return;
    setFunnels((previous) => previous.map((f) => (f.id === selectedLocalFunnel.id ? { ...f, name } : f)));
    void sendMessage({ type: 'pipeline:rename', payload: { id: selectedLocalFunnel.id, name } })
      .catch(() => setToast('Erro ao renomear funil no servidor.'));
    setToast('Funil atualizado.');
  };

  const activePanelTitle =
    railPanel === 'account'
      ? 'Minha Conta'
      : railPanel === 'lead'
        ? 'Card do Lead'
        : railPanel === 'templates'
          ? 'Modelos'
          : railPanel === 'lists'
            ? 'Listas de Contatos'
            : 'Calendario';

  if (!authChecked) {
    return <div className="crm-app-shell crm-fade-in" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="crm-app-shell crm-fade-in">
        <LoginScreen onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="crm-app-shell crm-fade-in">
      <div className={`crm-top-toolbar ${workspaceView === 'general' ? 'is-hidden' : ''}`}>
        <button
          type="button"
          onClick={() => setWorkspaceView('funnel')}
          className={`crm-top-toolbar-btn ${workspaceView === 'funnel' ? 'is-active' : ''}`}
        >
          Funil CRM
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceView('general')}
          className={`crm-top-toolbar-btn ${workspaceView === 'general' ? 'is-active' : ''}`}
        >
          CRM General
        </button>
      </div>

      {workspaceView === 'general' ? (
        <FunnelBoard
          funnelName={
            isCheckoutFunnelSelected
              ? checkoutBoard?.funnel.name ?? 'Checkout'
              : selectedLocalFunnel?.name ?? 'CRM General (Funil Principal)'
          }
          funnels={allFunnels}
          selectedFunnelId={selectedFunnelId}
          conversations={conversations}
          columns={boardColumns}
          cards={boardCards}
          pinnedCardColumns={!isCheckoutFunnelSelected ? pinnedOpportunityColumns : undefined}
          pinnedCardColumnsEnd={!isCheckoutFunnelSelected ? pinnedApprovedColumns : undefined}
          onSelectFunnel={setSelectedFunnelId}
          onCreateFunnel={handleCreateFunnel}
          onConfigureFunnel={handleConfigureFunnel}
          onCopyEmail={handleCopyEmail}
          onOpenConversation={handleOpenConversation}
          onAssignConversation={handleAssignConversation}
          onAssignPinnedCard={handleAssignPinnedCard}
          onUpdateCardEmail={handleUpdateCardEmail}
          onAddCardTag={handleAddCardTag}
          onRemoveCardTag={handleRemoveCardTag}
          availableTags={workspaceTags}
          onMoveCard={(cardId, columnId) => {
            void handleMoveCard(cardId, columnId);
          }}
          onRemoveCard={handleRemoveCard}
          onCreateColumn={handleCreateColumn}
          onUpdateColumn={handleUpdateColumn}
          onDeleteColumn={handleDeleteColumn}
          onReorderColumns={handleReorderColumns}
          onClose={() => {
            if (isCheckoutFunnelSelected && selectedLocalFunnel) {
              setSelectedFunnelId(selectedLocalFunnel.id);
            }
            setWorkspaceView('funnel');
          }}
          showRecentConversations={false}
          allowColumnManagement={!isCheckoutFunnelSelected}
          allowCreateStages={!isCheckoutFunnelSelected}
          compactCheckoutCards={isCheckoutFunnelSelected}
        />
      ) : null}

      {workspaceView === 'funnel' && boardColumns.length ? (
        <div className="crm-stagebar">
          <div className="crm-stagebar-inner crm-scrollbar">
            <label className="crm-stagebar-select-wrap">
              <span>Funil</span>
              <select
                className="crm-stagebar-select"
                value={selectedLocalFunnel?.id ?? funnels[0]?.id ?? ''}
                onChange={(event) => setSelectedFunnelId(event.target.value)}
              >
                {assignableFunnels.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>
                    {funnel.name}
                  </option>
                ))}
              </select>
            </label>
            {boardColumns.map((column) => {
              const isActive = activeConversationCard?.columnId === column.id;

              return (
                <button
                  key={column.id}
                  type="button"
                  className={`crm-stagebar-chip ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleMoveCurrentConversationToColumn(column.id)}
                  title={`Mover para ${column.name}`}
                >
                  <span className="crm-stagebar-chip-dot" style={{ backgroundColor: column.color }} />
                  <span>{column.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="crm-pointer-events-none crm-fixed crm-bottom-4 crm-left-1/2 crm-z-20 -crm-translate-x-1/2">
          <div className="crm-rounded-full crm-border crm-border-accent-500/20 crm-bg-slate-950/90 crm-px-4 crm-py-2 crm-text-xs crm-font-medium crm-text-accent-300 shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}

      <div className={`crm-right-rail-icons ${workspaceView === 'general' ? 'is-hidden' : ''}`}>
        <button
          type="button"
          onClick={() => toggleRailPanel('account')}
          className={`crm-right-rail-icon ${railPanel === 'account' && isRailOpen ? 'is-active' : ''}`}
          title="Minha Conta"
        >
          <UserCircle2 className="crm-h-5 crm-w-5" />
        </button>
        <button
          type="button"
          onClick={() => toggleRailPanel('lead')}
          className={`crm-right-rail-icon ${railPanel === 'lead' && isRailOpen ? 'is-active' : ''}`}
          title="Card do Lead"
        >
          <Contact className="crm-h-5 crm-w-5" />
        </button>
        <button
          type="button"
          onClick={() => toggleRailPanel('templates')}
          className={`crm-right-rail-icon ${railPanel === 'templates' && isRailOpen ? 'is-active' : ''}`}
          title="Modelos"
        >
          <MessageSquareText className="crm-h-5 crm-w-5" />
        </button>
        <button
          type="button"
          onClick={() => toggleRailPanel('calendar')}
          className={`crm-right-rail-icon ${railPanel === 'calendar' && isRailOpen ? 'is-active' : ''}`}
          title="Calendario"
        >
          <LayoutPanelTop className="crm-h-5 crm-w-5" />
        </button>
        <button
          type="button"
          onClick={() => toggleRailPanel('lists')}
          className={`crm-right-rail-icon ${railPanel === 'lists' && isRailOpen ? 'is-active' : ''}`}
          title="Listas"
        >
          <ListTodo className="crm-h-5 crm-w-5" />
        </button>
      </div>

      <aside className={`crm-right-rail ${workspaceView === 'general' || !isRailOpen ? 'is-hidden' : ''}`}>
        <div className="crm-right-rail-header">
          <h3>{activePanelTitle}</h3>
        </div>

        <div className="crm-right-rail-content crm-scrollbar">
          {railPanel === 'account' ? (
            <div className="crm-rail-stack">
              <div className="crm-rail-card">
                <div className="crm-rail-chip">{session?.user?.name ?? 'Conta'}</div>
                <p className="crm-mt-1 crm-text-xs crm-text-slate-400">{session?.user?.email}</p>
                <button type="button" className="crm-rail-cta" onClick={() => void handleLogout()}>
                  Sair da conta
                </button>
              </div>
              <div className="crm-rail-grid">
                <div className="crm-rail-stat">
                  <span>Numero</span>
                  <strong>{conversation.phone ?? context?.lead.normalizedPhone ?? '--'}</strong>
                </div>
                <div className="crm-rail-stat">
                  <span>Mensagens</span>
                  <strong>{context?.timeline.length ?? 0}</strong>
                </div>
                <div className="crm-rail-stat">
                  <span>Com info</span>
                  <strong>{context ? 1 : 0}</strong>
                </div>
                <div className="crm-rail-stat">
                  <span>Sem info</span>
                  <strong>{context ? 0 : 1}</strong>
                </div>
              </div>
            </div>
          ) : null}

          {railPanel === 'lead' ? (
            <div className="crm-rail-stack">
              {context?.lead ? (
                <>
                  <div className="crm-rail-card">
                    <div className="crm-rail-chip">{context.lead.name}</div>
                    {context.lead.currentStage ? (
                      <p className="crm-mt-1 crm-text-xs crm-text-slate-400">
                        Etapa: <span style={{ color: context.lead.currentStage.color ?? undefined }}>{context.lead.currentStage.name}</span>
                      </p>
                    ) : null}
                    <p className="crm-mt-1 crm-text-xs crm-text-slate-400">
                      {context.lead.phone ?? context.lead.normalizedPhone ?? 'Sem telefone'}
                    </p>
                  </div>

                  <div className="crm-rail-card">
                    <span className="crm-text-xs crm-font-semibold crm-text-slate-300">Email</span>
                    <p className="crm-mt-1 crm-text-sm crm-text-white">
                      {context.lead.email ?? <span className="crm-text-slate-500 crm-italic">E-mail: N/D</span>}
                    </p>
                    <button
                      type="button"
                      className="crm-mt-2 crm-text-xs crm-font-semibold crm-text-accent-300"
                      onClick={() => {
                        const value = window.prompt(`E-mail de ${context.lead.name}:`, context.lead.email ?? '')?.trim();
                        if (value) handleUpdateCardEmail(context.lead.id, value);
                      }}
                    >
                      {context.lead.email ? 'Editar email' : '+ Adicionar email'}
                    </button>
                  </div>

                  <div className="crm-rail-card">
                    <span className="crm-text-xs crm-font-semibold crm-text-slate-300">Valor</span>
                    <p className="crm-mt-1 crm-text-sm crm-text-white">
                      {context.lead.latestOrder ? (
                        <>
                          {formatCurrency(context.lead.latestOrder.amount, context.lead.latestOrder.currency)}
                          {context.lead.latestOrder.productName ? ` · ${context.lead.latestOrder.productName}` : ''}
                        </>
                      ) : (
                        <span className="crm-text-slate-500 crm-italic">Valor: N/D</span>
                      )}
                    </p>
                    <button
                      type="button"
                      className="crm-mt-2 crm-text-xs crm-font-semibold crm-text-accent-300"
                      onClick={() => {
                        const raw = window
                          .prompt('Valor (R$):', context.lead.latestOrder ? (context.lead.latestOrder.amount / 100).toFixed(2) : '')
                          ?.trim();
                        if (!raw) return;
                        const amount = Math.round(parseFloat(raw.replace(',', '.')) * 100);
                        if (!Number.isFinite(amount) || amount < 0) return;
                        const productName = window.prompt('Produto (opcional):', context.lead.latestOrder?.productName ?? '')?.trim();
                        handleUpdateCardValue(context.lead.id, amount, productName || undefined);
                      }}
                    >
                      {context.lead.latestOrder ? 'Editar valor' : '+ Adicionar valor'}
                    </button>
                  </div>

                  <div className="crm-rail-card">
                    <span className="crm-text-xs crm-font-semibold crm-text-slate-300">Tags</span>
                    <div className="crm-funnel-card-tags crm-mt-2">
                      {context.lead.tags?.map((tag) => (
                        <span
                          key={tag.id}
                          className="crm-funnel-card-tag"
                          style={{ borderColor: `${tag.color ?? '#334155'}55`, color: tag.color ?? '#cbd5e1' }}
                        >
                          {tag.name}
                          <button
                            type="button"
                            className="crm-funnel-card-tag-remove"
                            title="Remover tag"
                            onClick={() => handleRemoveCardTag(context.lead.id, tag.id)}
                          >
                            <X className="crm-h-2.5 crm-w-2.5" />
                          </button>
                        </span>
                      ))}
                      <TagPicker
                        availableTags={workspaceTags}
                        currentTagIds={(context.lead.tags ?? []).map((tag) => tag.id)}
                        onPick={(tag) => handleAddCardTag(context.lead.id, tag.name)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="crm-rail-empty">
                  <h4>Nenhum lead vinculado</h4>
                  <p>Abra uma conversa com um contato salvo no CRM para editar os dados aqui.</p>
                </div>
              )}
            </div>
          ) : null}

          {railPanel === 'templates' ? (
            <div className="crm-rail-stack">
              {context?.templates.map((template) => (
                <div key={template.id} className="crm-rail-list-card">
                  <h4>{template.title}</h4>
                  <p>{template.content}</p>
                </div>
              ))}
            </div>
          ) : null}

          {railPanel === 'lists' ? (
            <div className="crm-rail-stack">
              {boardColumns.map((stage) => (
                <div key={stage.id} className="crm-rail-list-card">
                  <div className="crm-flex crm-items-center crm-justify-between">
                    <strong>{stage.name}</strong>
                    <span>{boardCards.filter((lead) => lead.columnId === stage.id).length}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {railPanel === 'calendar' ? (
            <div className="crm-rail-empty">
              <h4>Nao ha eventos proximos</h4>
              <p>Crie seu primeiro evento para começar a organizar seu tempo.</p>
            </div>
          ) : null}
        </div>
      </aside>

      {messageHistory !== null ? (
        <MessageHistoryPanel
          leadName={messageHistoryLeadName}
          messages={messageHistory}
          onClose={() => setMessageHistory(null)}
        />
      ) : null}
    </div>
  );
}
