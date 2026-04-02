import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CreditCard,
  LayoutPanelTop,
  ListTodo,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  Wallet
} from 'lucide-react';
import { useBackground } from './hooks/useBackground';
import { useWhatsAppConversation } from './hooks/useWhatsAppConversation';
import { useWhatsAppConversationList } from './hooks/useWhatsAppConversationList';
import {
  getCurrentConversationAvatar,
  getSelectedConversationFromList,
  insertTextIntoWhatsAppComposer,
  openConversationInWhatsApp
} from './whatsapp';
import { demoLeadContext } from './demo-data';
import { copyToClipboard, formatCurrency } from '../shared/utils';
import type {
  AuthSession,
  LeadContext,
  MessageTemplate,
  TaskStatus
} from '../shared/types';
import { LeadHeaderCard } from './components/LeadHeaderCard';
import { SectionCard } from './components/SectionCard';
import { StatusBadge } from './components/StatusBadge';
import { EventTimeline } from './components/EventTimeline';
import { NoteList } from './components/NoteList';
import { TaskList } from './components/TaskList';
import { TemplateList } from './components/TemplateList';
import { PipelineCard } from './components/PipelineCard';
import { EmptyState } from './components/EmptyState';
import { LoadingState } from './components/LoadingState';
import { QuickAddForm } from './components/QuickAddForm';
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

export function SidebarApp() {
  const sendMessage = useBackground();
  const conversation = useWhatsAppConversation();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [context, setContext] = useState<LeadContext | null>(demoLeadContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('funnel');
  const [railPanel, setRailPanel] = useState<RailPanel>('account');
  const [funnels, setFunnels] = useState<SavedFunnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const isPreviewMode = !session?.token;
  const conversations = useWhatsAppConversationList({ scanAll: workspaceView === 'general' });

  const selectedFunnel = useMemo(() => {
    return funnels.find((funnel) => funnel.id === selectedFunnelId) ?? funnels[0] ?? null;
  }, [funnels, selectedFunnelId]);

  const boardColumns = selectedFunnel?.columns ?? [];
  const boardCards = selectedFunnel?.cards ?? [];
  const selectedConversationListItem = useMemo(() => getSelectedConversationFromList(), [conversation.label, conversation.phone]);
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
    if (!selectedFunnel) {
      return null;
    }

    return (
      selectedFunnel.cards.find((card) => {
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
  }, [conversation.phone, currentConversationListItem, safeConversationLabel, selectedFunnel]);

  const refresh = async () => {
    if (!conversation.phone) {
      setContext(demoLeadContext);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await sendMessage<LeadContext | null>({
        type: 'lead:fetch-context',
        payload: { phone: conversation.phone }
      });
      setContext(data);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Falha ao carregar lead.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const currentSession = await sendMessage<AuthSession>({ type: 'auth:get-session' });
        setSession(currentSession);
      } catch {
        setSession(null);
        setContext(demoLeadContext);
        setError(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [sendMessage]);

  useEffect(() => {
    void refresh();
  }, [conversation.phone, session?.token]);

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
          if (typeof storedSelectedFunnelId === 'string') {
            setSelectedFunnelId(storedSelectedFunnelId);
          } else {
            setSelectedFunnelId((storedFunnels[0] as SavedFunnel).id);
          }
          return;
        }

        const defaultFunnel: SavedFunnel = {
          id: `funnel-${Date.now()}`,
          name: 'CRM General (Funil Principal)',
          columns: Array.isArray(legacyColumns) ? (legacyColumns as FunnelColumn[]) : [],
          cards: Array.isArray(legacyCards) ? (legacyCards as FunnelCard[]) : []
        };

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
    if (!selectedFunnel || selectedFunnel.columns.length || !context?.pipeline?.stages?.length) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedFunnel.id
          ? {
              ...funnel,
              columns: [
                {
                  id: `column-${Date.now()}`,
                  name: context.pipeline.stages[0].name,
                  color: context.pipeline.stages[0].color ?? '#047515'
                }
              ]
            }
          : funnel
      )
    );
  }, [selectedFunnel, context?.pipeline?.stages]);

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

    return () => {
      document.body.classList.remove(
        'crm-john-with-rail',
        'crm-john-with-toolbar',
        'crm-john-with-stagebar',
        'crm-john-funnel-open',
        'crm-john-rail-hidden'
      );
    };
  }, [workspaceView]);

  const statusCards = useMemo(() => {
    const order = context?.lead.latestOrder;
    if (!order) {
      return [];
    }

    return [
      {
        title: 'Checkout Iniciado',
        active: ['OPEN', 'ABANDONED', 'PENDING', 'APPROVED', 'DECLINED'].includes(order.status),
        icon: Wallet
      },
      {
        title: 'Pix Pendente',
        active: order.status === 'PENDING',
        icon: Wallet
      },
      {
        title: 'Cartão Recusado',
        active: order.status === 'DECLINED',
        icon: CreditCard
      },
      {
        title: 'Compra Aprovada',
        active: order.status === 'APPROVED',
        icon: BadgeCheck
      }
    ];
  }, [context?.lead.latestOrder]);

  const withLead = async (operation: () => Promise<void>) => {
    try {
      await operation();
      await refresh();
      if (isPreviewMode) {
        setToast('Modo local: ação salva com sucesso.');
      }
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Falha ao atualizar lead.');
    }
  };

  const handleCopyTemplate = async (template: MessageTemplate) => {
    await copyToClipboard(template.content);
    setToast(`Template "${template.title}" copiado.`);
  };

  const handleInsertTemplate = async (template: MessageTemplate) => {
    const inserted = insertTextIntoWhatsAppComposer(template.content);
    setToast(inserted ? `Template "${template.title}" inserido.` : 'Campo de mensagem não encontrado.');
  };

  const handleTaskToggle = async (taskId: string, status: TaskStatus) => {
    await withLead(async () => {
      await sendMessage<void>({
        type: 'task:update-status',
        payload: { taskId, status }
      });
    });
  };

  const handleLogout = async () => {
    await sendMessage({ type: 'auth:logout' });
    setSession(null);
    setError(null);
    await refresh();
  };

  const handleOpenConversation = async ({
    phone,
    name
  }: {
    name: string;
    phone: string | null;
  }) => {
    const opened = await openConversationInWhatsApp(phone ?? '', name);
    if (opened) {
      setWorkspaceView('funnel');
      return;
    }

    if (!opened) {
      setToast('Nao consegui focar a conversa automaticamente.');
    }
  };

  const handleCreateColumn = ({ name, color }: { name: string; color: string }) => {
    if (!selectedFunnel) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedFunnel.id
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
    if (!selectedFunnel) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedFunnel.id
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
    if (!selectedFunnel) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedFunnel.id
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
    if (!selectedFunnel) {
      return;
    }

    setFunnels((previousFunnels) =>
      previousFunnels.map((funnel) => {
        if (funnel.id !== selectedFunnel.id) {
          return funnel;
        }

        const exists = funnel.cards.find(
        (card) =>
          (card.phone && conversationItem.phone && card.phone === conversationItem.phone) ||
          card.name === conversationItem.name
        );

        if (exists) {
          return {
            ...funnel,
            cards: funnel.cards.map((card) =>
              card.id === exists.id
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

  const handleMoveCard = (cardId: string, columnId: string) => {
    if (!selectedFunnel) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedFunnel.id
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
    if (!selectedFunnel || (!conversation.phone && !safeConversationLabel && !currentConversationListItem)) {
      return;
    }

    if (activeConversationCard) {
      handleMoveCard(activeConversationCard.id, columnId);
      return;
    }

    if (currentConversationListItem) {
      handleAssignConversation(currentConversationListItem, columnId);
      return;
    }

    handleAssignConversation(
      {
        id: `current-${conversation.phone ?? conversation.label ?? Date.now()}`,
        name: currentConversationListItem?.name ?? safeConversationLabel ?? conversation.phone ?? 'Conversa atual',
        phone: conversation.phone,
        avatarUrl: getCurrentConversationAvatar()
      },
      columnId
    );
  };

  const handleRemoveCard = (cardId: string) => {
    if (!selectedFunnel) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) =>
        funnel.id === selectedFunnel.id
          ? { ...funnel, cards: funnel.cards.filter((card) => card.id !== cardId) }
          : funnel
      )
    );
    setToast('Contato removido da etapa.');
  };

  const handleReorderColumns = (columnId: string, targetColumnId: string) => {
    if (!selectedFunnel) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) => {
        if (funnel.id !== selectedFunnel.id) {
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
    if (!selectedFunnel) {
      return;
    }

    const name = window.prompt('Nome do funil:', selectedFunnel.name)?.trim();
    if (!name) {
      return;
    }

    setFunnels((previous) =>
      previous.map((funnel) => (funnel.id === selectedFunnel.id ? { ...funnel, name } : funnel))
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
          funnelName={selectedFunnel?.name ?? 'CRM General (Funil Principal)'}
          funnels={funnels.map((funnel) => ({ id: funnel.id, name: funnel.name }))}
          selectedFunnelId={selectedFunnelId}
          conversations={conversations}
          columns={boardColumns}
          cards={boardCards}
          onSelectFunnel={setSelectedFunnelId}
          onCreateFunnel={handleCreateFunnel}
          onConfigureFunnel={handleConfigureFunnel}
          onOpenConversation={handleOpenConversation}
          onAssignConversation={handleAssignConversation}
          onMoveCard={handleMoveCard}
          onRemoveCard={handleRemoveCard}
          onCreateColumn={handleCreateColumn}
          onUpdateColumn={handleUpdateColumn}
          onDeleteColumn={handleDeleteColumn}
          onReorderColumns={handleReorderColumns}
          onClose={() => setWorkspaceView('funnel')}
        />
      ) : null}

      {workspaceView === 'funnel' && selectedFunnel && boardColumns.length ? (
        <div className="crm-stagebar">
          <div className="crm-stagebar-inner crm-scrollbar">
            <label className="crm-stagebar-select-wrap">
              <span>Funil</span>
              <select
                className="crm-stagebar-select"
                value={selectedFunnelId}
                onChange={(event) => setSelectedFunnelId(event.target.value)}
              >
                {funnels.map((funnel) => (
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

      {workspaceView === 'funnel' ? (
        <div className="crm-noise crm-flex crm-h-full crm-flex-col crm-overflow-hidden crm-rounded-[32px] crm-border crm-border-white/10 crm-bg-aurora crm-text-white crm-shadow-glow crm-shadow-black/60">
          <div className="crm-flex crm-items-center crm-justify-between crm-border-b crm-border-white/8 crm-px-5 crm-py-4">
            <div>
              <p className="crm-text-[11px] crm-font-semibold crm-uppercase crm-tracking-[0.28em] crm-text-accent-300">
                CRM John
              </p>
              <h1 className="crm-mt-1 crm-text-sm crm-font-medium crm-text-white">
                {conversation.label ?? 'WhatsApp Web'}
              </h1>
            </div>
            <div className="crm-flex crm-items-center crm-gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/5 crm-p-2.5 crm-text-slate-200 transition hover:crm-border-accent-500/30 hover:crm-text-white"
                title="Atualizar"
              >
                <RefreshCcw className="crm-h-4 crm-w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/5 crm-p-2.5 crm-text-slate-200 transition hover:crm-border-rose-400/25 hover:crm-text-rose-200"
                title="Sair"
              >
                <LogOut className="crm-h-4 crm-w-4" />
              </button>
            </div>
          </div>

          <div className="crm-scrollbar crm-flex-1 crm-space-y-4 crm-overflow-y-auto crm-p-4">
            {!session?.token ? (
              <SectionCard title="Modo Preview" subtitle="Visual liberado sem backend para você validar a experiência.">
                <div className="crm-rounded-2xl crm-border crm-border-cyan-400/15 crm-bg-cyan-400/10 crm-p-4">
                  <p className="crm-text-sm crm-font-medium crm-text-cyan-100">
                    A sidebar está usando dados demonstrativos.
                  </p>
                  <p className="crm-mt-1 crm-text-xs crm-leading-5 crm-text-cyan-100/80">
                    Quando o backend estiver pronto, basta fazer login no popup para trocar automaticamente do modo preview para dados reais.
                  </p>
                </div>
              </SectionCard>
            ) : null}

            {session?.token && !conversation.phone ? (
              <EmptyState
                title="Conversa sem telefone detectado"
                description="Abra uma conversa com número identificável para carregar dados do lead automaticamente."
              />
            ) : null}

            {loading ? <LoadingState /> : null}

            {error ? (
              <SectionCard title="Falha de carregamento">
                <div className="crm-flex crm-items-start crm-gap-3 crm-rounded-2xl crm-border crm-border-rose-400/15 crm-bg-rose-400/10 crm-p-4 crm-text-rose-100">
                  <AlertCircle className="crm-mt-0.5 crm-h-5 crm-w-5" />
                  <div>
                    <p className="crm-text-sm crm-font-medium">Não foi possível sincronizar a sidebar.</p>
                    <p className="crm-mt-1 crm-text-xs crm-leading-5 crm-text-rose-100/80">{error}</p>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {!loading && session?.token && conversation.phone && !context && !error ? (
              <EmptyState
                title="Lead não encontrado"
                description={`Nenhum lead foi localizado para o número ${conversation.phone}. Quando ele existir no backend, a sidebar será preenchida aqui.`}
              />
            ) : null}

            {context ? (
              <>
                <LeadHeaderCard lead={context.lead} />

                <SectionCard
                  title="Sinais Comerciais"
                  subtitle="Resumo visual dos gatilhos mais relevantes para a recuperação da venda."
                >
                  <div className="crm-grid crm-grid-cols-2 crm-gap-3">
                    {statusCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div
                          key={card.title}
                          className={`crm-rounded-2xl crm-border crm-p-3 ${
                            card.active
                              ? 'crm-border-accent-500/25 crm-bg-accent-500/12'
                              : 'crm-border-white/8 crm-bg-white/[0.04]'
                          }`}
                        >
                          <div className="crm-flex crm-items-center crm-gap-2 crm-text-slate-200">
                            <Icon className="crm-h-4 crm-w-4" />
                            <span className="crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em]">
                              {card.title}
                            </span>
                          </div>
                          <p className="crm-mt-3 crm-text-lg crm-font-semibold crm-text-white">
                            {card.active ? 'Ativo' : 'Inativo'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Pipeline"
                  subtitle={`Etapa atual: ${context.lead.currentStage?.name ?? 'Sem definição'}`}
                  action={
                    context.lead.currentStage ? (
                      <StatusBadge label={context.lead.currentStage.name} tone="success" icon="success" />
                    ) : null
                  }
                >
                  <PipelineCard
                    pipeline={context.pipeline}
                    currentStageId={context.lead.currentStage?.id}
                    onMove={(stageId) =>
                      void withLead(async () => {
                        await sendMessage<void>({
                          type: 'lead:update-stage',
                          payload: { leadId: context.lead.id, stageId }
                        });
                      })
                    }
                  />
                </SectionCard>

                <SectionCard title="Timeline" subtitle="Eventos mais recentes em ordem decrescente.">
                  {context.timeline.length ? (
                    <EventTimeline items={context.timeline.slice(0, 12)} />
                  ) : (
                    <EmptyState
                      title="Sem eventos recentes"
                      description="A timeline ficará disponível assim que notas, tarefas ou eventos de checkout forem registrados."
                    />
                  )}
                </SectionCard>

                <SectionCard title="Tags" subtitle="Segmentação visual para contexto rápido do contato.">
                  {context.lead.tags?.length ? (
                    <div className="crm-flex crm-flex-wrap crm-gap-2">
                      {context.lead.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="crm-inline-flex crm-items-center crm-gap-2 crm-rounded-full crm-border crm-border-white/10 crm-bg-white/[0.04] crm-px-3 crm-py-2 crm-text-xs crm-font-medium crm-text-slate-200"
                        >
                          <span
                            className="crm-h-2 crm-w-2 crm-rounded-full"
                            style={{ backgroundColor: tag.color ?? '#3dd9b5' }}
                          />
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Sem tags vinculadas"
                      description="As tags aparecerão aqui para ajudar o time a identificar contexto e prioridade."
                    />
                  )}
                </SectionCard>

                <SectionCard title="Notas" subtitle="Últimas observações operacionais do lead.">
                  <QuickAddForm
                    multiline
                    placeholder="Adicionar observação rápida..."
                    buttonLabel="Salvar Nota"
                    onSubmit={(content) =>
                      withLead(async () => {
                        await sendMessage<void>({
                          type: 'lead:add-note',
                          payload: { leadId: context.lead.id, content }
                        });
                      })
                    }
                  />
                  <div className="crm-mt-4">
                    {context.notes.length ? (
                      <NoteList notes={context.notes.slice(0, 6)} />
                    ) : (
                      <EmptyState
                        title="Nenhuma nota ainda"
                        description="Use este espaço para registrar objeções, contexto e próximos passos."
                      />
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Tarefas" subtitle="Pendências rápidas e follow-ups do atendimento.">
                  <QuickAddForm
                    placeholder="Criar tarefa rápida..."
                    buttonLabel="Criar Tarefa"
                    onSubmit={(title) =>
                      withLead(async () => {
                        await sendMessage<void>({
                          type: 'lead:create-task',
                          payload: { leadId: context.lead.id, title }
                        });
                      })
                    }
                  />
                  <div className="crm-mt-4">
                    {context.tasks.length ? (
                      <TaskList tasks={context.tasks.slice(0, 6)} onToggle={handleTaskToggle} />
                    ) : (
                      <EmptyState
                        title="Sem tarefas abertas"
                        description="Crie tarefas para organizar retorno, cobrança ou recuperação."
                      />
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Templates"
                  subtitle={`Prontos para copiar ou inserir. Último pedido: ${formatCurrency(
                    context.lead.latestOrder?.amount,
                    context.lead.latestOrder?.currency ?? 'BRL'
                  )}.`}
                >
                  {context.templates.length ? (
                    <TemplateList
                      templates={context.templates}
                      onCopy={(template) => void handleCopyTemplate(template)}
                      onInsert={(template) => void handleInsertTemplate(template)}
                    />
                  ) : (
                    <EmptyState
                      title="Sem templates disponíveis"
                      description="Quando o backend retornar templates por categoria, eles aparecerão aqui automaticamente."
                    />
                  )}
                </SectionCard>
              </>
            ) : null}
          </div>

          {toast ? (
            <div className="crm-pointer-events-none crm-absolute crm-bottom-4 crm-left-1/2 crm-z-20 -crm-translate-x-1/2">
              <div className="crm-rounded-full crm-border crm-border-accent-500/20 crm-bg-slate-950/90 crm-px-4 crm-py-2 crm-text-xs crm-font-medium crm-text-accent-300 shadow-lg">
                {toast}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <aside className={`crm-right-rail ${workspaceView === 'general' ? 'is-hidden' : ''}`}>
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

        <div className="crm-right-rail-icons">
          <button
            type="button"
            onClick={() => setRailPanel('templates')}
            className={`crm-right-rail-icon ${railPanel === 'templates' ? 'is-active' : ''}`}
            title="Modelos"
          >
            <MessageSquareText className="crm-h-5 crm-w-5" />
          </button>
          <button
            type="button"
            onClick={() => setRailPanel('calendar')}
            className={`crm-right-rail-icon ${railPanel === 'calendar' ? 'is-active' : ''}`}
            title="Calendario"
          >
            <LayoutPanelTop className="crm-h-5 crm-w-5" />
          </button>
          <button
            type="button"
            onClick={() => setRailPanel('lists')}
            className={`crm-right-rail-icon ${railPanel === 'lists' ? 'is-active' : ''}`}
            title="Listas"
          >
            <ListTodo className="crm-h-5 crm-w-5" />
          </button>
        </div>
      </aside>
    </div>
  );
}
