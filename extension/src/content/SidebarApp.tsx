import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutPanelTop, ListTodo, MessageSquareText } from 'lucide-react';
import { demoLeadContext } from './demo-data';
import { useBackground } from './hooks/useBackground';
import { useWhatsAppConversation } from './hooks/useWhatsAppConversation';
import { useWhatsAppConversationList } from './hooks/useWhatsAppConversationList';
import { copyToClipboard, normalizePhone } from '../shared/utils';
import {
  getAllWhatsAppConversationList,
  forceOpenConversationByPhoneNumber,
  getCurrentConversationAvatar,
  getSelectedConversationFromList,
  insertTextIntoWhatsAppComposer,
  openConversationByPhoneNumber,
  openConversationInWhatsApp
} from './whatsapp';
import type { AuthSession, CheckoutBoardData, LeadContext, MessageTemplate } from '../shared/types';
import {
  FunnelBoard,
  type FunnelCard,
  type FunnelColumn
} from './components/FunnelBoard';

type WorkspaceView = 'general' | 'funnel';
type RailPanel = 'account' | 'templates' | 'lists' | 'calendar';

interface SavedFunnel {
  id: string;
  name: string;
  columns: FunnelColumn[];
  cards: FunnelCard[];
}

const FUNNELS_STORAGE_KEY = 'crm-john-funnels';
const SELECTED_FUNNEL_STORAGE_KEY = 'crm-john-selected-funnel-id';
const LEGACY_BOARD_COLUMNS_STORAGE_KEY = 'crm-john-funnel-columns';
const LEGACY_BOARD_CARDS_STORAGE_KEY = 'crm-john-funnel-cards';
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

function createDefaultFunnel(columns: FunnelColumn[] = [], cards: FunnelCard[] = []): SavedFunnel {
  return {
    id: `funnel-${Date.now()}`,
    name: 'CRM General (Funil Principal)',
    columns,
    cards
  };
}

export function SidebarApp() {
  const sendMessage = useBackground();
  const conversation = useWhatsAppConversation();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [context, setContext] = useState<LeadContext | null>(demoLeadContext);
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('funnel');
  const [railPanel, setRailPanel] = useState<RailPanel>('account');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [funnels, setFunnels] = useState<SavedFunnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [checkoutBoard, setCheckoutBoard] = useState<CheckoutBoardData | null>(null);
  const [workspaceTemplates, setWorkspaceTemplates] = useState<MessageTemplate[]>([]);
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
  const boardCards = isCheckoutFunnelSelected ? checkoutCards : selectedLocalFunnel?.cards ?? [];

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
      }
    })();
  }, [sendMessage]);

  useEffect(() => {
    void refreshLeadContext();
  }, [refreshLeadContext, session?.token]);

  useEffect(() => {
    void loadCheckoutBoard();
  }, [loadCheckoutBoard, session?.token]);

  useEffect(() => {
    void loadWorkspaceTemplates();
  }, [loadWorkspaceTemplates, session?.token]);

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

  useEffect(() => {
    void chrome.storage.local
      .get([
        FUNNELS_STORAGE_KEY,
        SELECTED_FUNNEL_STORAGE_KEY,
        LEGACY_BOARD_COLUMNS_STORAGE_KEY,
        LEGACY_BOARD_CARDS_STORAGE_KEY
      ])
      .then((result) => {
        const storedFunnels = result[FUNNELS_STORAGE_KEY];
        const storedSelectedFunnelId = result[SELECTED_FUNNEL_STORAGE_KEY];
        const legacyColumns = result[LEGACY_BOARD_COLUMNS_STORAGE_KEY];
        const legacyCards = result[LEGACY_BOARD_CARDS_STORAGE_KEY];

        if (Array.isArray(storedFunnels) && storedFunnels.length) {
          setFunnels(storedFunnels as SavedFunnel[]);
          setSelectedFunnelId(
            typeof storedSelectedFunnelId === 'string'
              ? storedSelectedFunnelId
              : (storedFunnels[0] as SavedFunnel).id
          );
          return;
        }

        const defaultFunnel = createDefaultFunnel(
          Array.isArray(legacyColumns) ? (legacyColumns as FunnelColumn[]) : [],
          Array.isArray(legacyCards) ? (legacyCards as FunnelCard[]) : []
        );

        setFunnels([defaultFunnel]);
        setSelectedFunnelId(defaultFunnel.id);
      });
  }, []);

  useEffect(() => {
    if (!funnels.length) {
      return;
    }

    void chrome.storage.local.set({
      [FUNNELS_STORAGE_KEY]: funnels,
      [SELECTED_FUNNEL_STORAGE_KEY]: selectedFunnelId || funnels[0]?.id || ''
    });
  }, [funnels, selectedFunnelId]);

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
    name
  }: {
    name: string;
    phone: string | null;
  }) => {
    const normalizedCardPhone = phone ? normalizePhone(phone) : null;
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
    const resolvedPhone = phone ?? matchedConversation?.phone ?? null;

    if (isCheckoutFunnelSelected && resolvedPhone && !conversationMatch) {
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

    const opened = await openConversationInWhatsApp(finalPhone ?? '', finalName);
    if (opened) {
      setWorkspaceView('funnel');
      return;
    }

    if (finalPhone && (await openConversationByPhoneNumber(finalPhone))) {
      setWorkspaceView('funnel');
      setToast('Abrindo conversa por numero.');
      return;
    }

    if (isCheckoutFunnelSelected && finalPhone && !conversationMatch) {
      if (forceOpenConversationByPhoneNumber(finalPhone)) {
        setWorkspaceView('funnel');
        return;
      }
    }

    setToast('Nao consegui focar ou iniciar a conversa automaticamente.');
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
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedLocalFunnel.id
          ? { ...funnel, columns: [...funnel.columns, { id: `column-${Date.now()}`, name, color }] }
          : funnel
      )
    );
    setToast('Nova etapa criada.');
  };

  const handleUpdateColumn = ({
    id,
    name,
    color
  }: {
    id: string;
    name: string;
    color: string;
  }) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedLocalFunnel.id
          ? {
              ...funnel,
              columns: funnel.columns.map((column) => (column.id === id ? { ...column, name, color } : column))
            }
          : funnel
      )
    );
    setToast('Etapa atualizada.');
  };

  const handleDeleteColumn = (columnId: string) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedLocalFunnel.id
          ? {
              ...funnel,
              columns: funnel.columns.filter((column) => column.id !== columnId),
              cards: funnel.cards.filter((card) => card.columnId !== columnId)
            }
          : funnel
      )
    );
    setToast('Etapa removida.');
  };

  const handleAssignConversation = (
    conversationItem: (typeof conversations)[number],
    columnId: string
  ) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) {
      return;
    }

    setFunnels((previousFunnels) =>
      previousFunnels.map((funnel) => {
        if (funnel.id !== selectedLocalFunnel.id) {
          return funnel;
        }

        const existing = funnel.cards.find(
          (card) =>
            (card.phone && conversationItem.phone && card.phone === conversationItem.phone) ||
            card.name === conversationItem.name
        );

        if (existing) {
          return {
            ...funnel,
            cards: funnel.cards.map((card) =>
              card.id === existing.id
                ? {
                    ...card,
                    columnId,
                    name: conversationItem.name,
                    phone: conversationItem.phone,
                    avatarUrl: conversationItem.avatarUrl
                  }
                : card
            )
          };
        }

        return {
          ...funnel,
          cards: [
            ...funnel.cards,
            {
              id: `card-${Date.now()}-${conversationItem.id}`,
              name: conversationItem.name,
              phone: conversationItem.phone,
              avatarUrl: conversationItem.avatarUrl,
              columnId
            }
          ]
        };
      })
    );
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

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedLocalFunnel.id
          ? {
              ...funnel,
              cards: funnel.cards.map((card) => (card.id === cardId ? { ...card, columnId } : card))
            }
          : funnel
      )
    );
    setToast('Card movido no funil.');
  };

  const handleMoveCurrentConversationToColumn = (columnId: string) => {
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
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedLocalFunnel.id
          ? { ...funnel, cards: funnel.cards.filter((card) => card.id !== cardId) }
          : funnel
      )
    );
    setToast('Contato removido da etapa.');
  };

  const handleReorderColumns = (columnId: string, targetColumnId: string) => {
    if (!selectedLocalFunnel || isCheckoutFunnelSelected) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) => {
        if (funnel.id !== selectedLocalFunnel.id) {
          return funnel;
        }

        const fromIndex = funnel.columns.findIndex((column) => column.id === columnId);
        const targetIndex = funnel.columns.findIndex((column) => column.id === targetColumnId);

        if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
          return funnel;
        }

        const nextColumns = [...funnel.columns];
        const [movedColumn] = nextColumns.splice(fromIndex, 1);
        nextColumns.splice(targetIndex, 0, movedColumn);
        return { ...funnel, columns: nextColumns };
      })
    );
    setToast('Etapas reorganizadas.');
  };

  const handleCreateFunnel = () => {
    const name = window.prompt('Nome do novo funil:', `Novo Funil ${funnels.length + 1}`)?.trim();
    if (!name) {
      return;
    }

    const newFunnel: SavedFunnel = {
      id: `funnel-${Date.now()}`,
      name,
      columns: [],
      cards: []
    };

    setFunnels((previous) => [...previous, newFunnel]);
    setSelectedFunnelId(newFunnel.id);
    setToast('Novo funil criado.');
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
    if (!name) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) => (funnel.id === selectedLocalFunnel.id ? { ...funnel, name } : funnel))
    );
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
                <div className="crm-rail-chip">free</div>
                <button type="button" className="crm-rail-cta">
                  Atualizar para VIP
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
    </div>
  );
}
