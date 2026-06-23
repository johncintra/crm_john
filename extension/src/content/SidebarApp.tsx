import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutPanelTop, ListTodo, MessageSquareText, UserCircle2 } from 'lucide-react';
import { demoLeadContext } from './demo-data';
import { useBackground } from './hooks/useBackground';
import { useWhatsAppConversation } from './hooks/useWhatsAppConversation';
import { useWhatsAppConversationList } from './hooks/useWhatsAppConversationList';
import { copyToClipboard, normalizePhone } from '../shared/utils';
import { savePendingMessageHistory, takePendingMessageHistory } from '../shared/storage';
import {
  getAllWhatsAppConversationList,
  forceOpenConversationByPhoneNumber,
  getCurrentConversationAvatar,
  getOpenConversationMessages,
  getRealContactPhoneNumber,
  getSelectedConversationFromList,
  insertTextIntoWhatsAppComposer,
  openConversationByPhoneNumber,
  openConversationInWhatsApp
} from './whatsapp';
import type { AuthSession, CheckoutBoardData, LeadContext, MessageTemplate, RemoteLeadMessage } from '../shared/types';
import {
  FunnelBoard,
  type FunnelCard,
  type FunnelColumn
} from './components/FunnelBoard';
import { LoginScreen } from './components/LoginScreen';
import { MessageHistoryPanel } from './components/MessageHistoryPanel';

type WorkspaceView = 'general' | 'funnel';
type RailPanel = 'account' | 'templates' | 'lists' | 'calendar';

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
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('funnel');
  const [railPanel, setRailPanel] = useState<RailPanel>('account');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [funnels, setFunnels] = useState<SavedFunnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [funnelsLoaded, setFunnelsLoaded] = useState(false);
  const [checkoutBoard, setCheckoutBoard] = useState<CheckoutBoardData | null>(null);
  const [workspaceTemplates, setWorkspaceTemplates] = useState<MessageTemplate[]>([]);
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
      tags: (card.tags ?? []).filter((tag) => {
        const normalizedName = tag.name.trim().toLowerCase();
        return normalizedName !== 'kiwify' && normalizedName !== 'hotmart';
      }),
      latestOrder: card.latestOrder
    }));
  }, [checkoutBoard?.cards, checkoutColumns]);

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
  const boardCardsRaw = isCheckoutFunnelSelected ? checkoutCards : selectedLocalFunnel?.cards ?? [];
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

  const loadWorkspaceTemplates = useCallback(async () => {
    try {
      const data = await sendMessage<MessageTemplate[]>({ type: 'workspace:fetch-templates' });
      if (Array.isArray(data) && data.length) {
        setWorkspaceTemplates(data);
      }
    } catch {
      // non-critical — templates will be missing but everything else works
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
    if (!isAuthenticated) return;
    void loadWorkspaceTemplates();
  }, [loadWorkspaceTemplates, isAuthenticated]);

  useEffect(() => {
    if (selectedFunnelId === CHECKOUT_FUNNEL_ID) {
      void loadCheckoutBoard();
    }
  }, [loadCheckoutBoard, selectedFunnelId]);

  useEffect(() => {
    if (workspaceView !== 'general' || selectedFunnelId !== CHECKOUT_FUNNEL_ID) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadCheckoutBoard();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadCheckoutBoard, selectedFunnelId, workspaceView]);

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

    if (resolvedPhone && !conversationMatch) {
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

  const handleSendTemplate = async (card: FunnelCard, columnName: string) => {
    const n = columnName.trim().toLowerCase();
    let category: MessageTemplate['category'] = 'GENERAL';
    if (n.includes('pix') || n.includes('boleto')) category = 'PIX_PENDING';
    else if (n.includes('recusad')) category = 'CREDIT_CARD_DECLINED';
    else if (n.includes('aprovad')) category = 'PURCHASE_APPROVED';

    const template =
      workspaceTemplates.find((t) => t.category === category) ??
      workspaceTemplates.find((t) => t.category === 'GENERAL') ??
      workspaceTemplates[0] ??
      null;

    await handleOpenConversation(card);

    if (!template) {
      setToast('Nenhum template encontrado para essa etapa.');
      return;
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
    const inserted = insertTextIntoWhatsAppComposer(template.content);
    setToast(inserted ? `Template "${template.title}" inserido.` : 'Conversa aberta.');
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await copyToClipboard(email);
      setToast('Email copiado.');
    } catch {
      setToast('Nao consegui copiar o email.');
    }
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
          onSelectFunnel={setSelectedFunnelId}
          onCreateFunnel={handleCreateFunnel}
          onConfigureFunnel={handleConfigureFunnel}
          onCopyEmail={handleCopyEmail}
          onOpenConversation={handleOpenConversation}
          onAssignConversation={handleAssignConversation}
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
          showRecentConversations={!isCheckoutFunnelSelected}
          allowColumnManagement={!isCheckoutFunnelSelected}
          allowCreateStages={!isCheckoutFunnelSelected}
          compactCheckoutCards={isCheckoutFunnelSelected}
          templates={isCheckoutFunnelSelected ? workspaceTemplates : undefined}
          onSendTemplate={
            isCheckoutFunnelSelected
              ? (card, columnName) => { void handleSendTemplate(card, columnName); }
              : undefined
          }
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
