import { MessageCircle, Plus, Settings, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WhatsAppConversationItem } from '../whatsapp';

export interface FunnelColumn {
  id: string;
  name: string;
  color: string;
}

export interface FunnelCard {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  columnId: string;
  leadId?: string;
  source?: string | null;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  latestOrder?: {
    id: string;
    productName: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
  } | null;
}

interface FunnelBoardProps {
  funnelName: string;
  funnels: Array<{ id: string; name: string }>;
  selectedFunnelId: string;
  conversations: WhatsAppConversationItem[];
  columns: FunnelColumn[];
  cards: FunnelCard[];
  onSelectFunnel: (funnelId: string) => void;
  onCreateFunnel: () => void;
  onConfigureFunnel: () => void;
  onOpenConversation: (conversation: { name: string; phone: string | null }) => void;
  onAssignConversation: (conversation: WhatsAppConversationItem, columnId: string) => void;
  onMoveCard: (cardId: string, columnId: string) => void;
  onRemoveCard: (cardId: string) => void;
  onCreateColumn: (payload: { name: string; color: string }) => void;
  onUpdateColumn: (payload: { id: string; name: string; color: string }) => void;
  onDeleteColumn: (columnId: string) => void;
  onReorderColumns: (columnId: string, targetColumnId: string) => void;
  onClose: () => void;
  showRecentConversations?: boolean;
  allowColumnManagement?: boolean;
  allowCreateStages?: boolean;
}

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; column: FunnelColumn }
  | { type: 'delete'; column: FunnelColumn }
  | null;

function FunnelAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="crm-funnel-avatar-img"
        draggable={false}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <div className="crm-funnel-avatar">{name.slice(0, 2).toUpperCase()}</div>;
}

export function FunnelBoard({
  funnelName,
  funnels,
  selectedFunnelId,
  conversations,
  columns,
  cards,
  onSelectFunnel,
  onCreateFunnel,
  onConfigureFunnel,
  onOpenConversation,
  onAssignConversation,
  onMoveCard,
  onRemoveCard,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onReorderColumns,
  onClose,
  showRecentConversations = true,
  allowColumnManagement = true,
  allowCreateStages = true
}: FunnelBoardProps) {
  const [search, setSearch] = useState('');
  const [draggedConversation, setDraggedConversation] = useState<WhatsAppConversationItem | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#047515');
  const [maxScrollLeft, setMaxScrollLeft] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const columnsRef = useRef<HTMLDivElement | null>(null);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) {
      return conversations;
    }

    return conversations.filter((item) => {
      const text = `${item.name} ${item.phone ?? ''}`.toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [conversations, normalizedSearch]);

  const openCreateModal = () => {
    setFormName('');
    setFormColor('#047515');
    setModal({ type: 'create' });
  };

  const openEditModal = (column: FunnelColumn) => {
    setFormName(column.name);
    setFormColor(column.color);
    setModal({ type: 'edit', column });
  };

  const openDeleteModal = (column: FunnelColumn) => {
    setModal({ type: 'delete', column });
  };

  const submitModal = () => {
    if (modal?.type === 'delete') {
      onDeleteColumn(modal.column.id);
      setModal(null);
      return;
    }

    if (!formName.trim()) {
      return;
    }

    if (modal?.type === 'create') {
      onCreateColumn({ name: formName.trim(), color: formColor });
    }

    if (modal?.type === 'edit') {
      onUpdateColumn({ id: modal.column.id, name: formName.trim(), color: formColor });
    }

    setModal(null);
  };

  useEffect(() => {
    const updateScrollMetrics = () => {
      const element = columnsRef.current;
      if (!element) {
        setMaxScrollLeft(0);
        setScrollLeft(0);
        return;
      }

      const nextMaxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
      setMaxScrollLeft(nextMaxScrollLeft);
      setScrollLeft(Math.min(element.scrollLeft, nextMaxScrollLeft));
    };

    updateScrollMetrics();

    const element = columnsRef.current;
    if (!element) {
      return;
    }

    const handleScroll = () => {
      setScrollLeft(element.scrollLeft);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollMetrics);
    const resizeObserver = new ResizeObserver(() => {
      updateScrollMetrics();
    });
    resizeObserver.observe(element);
    window.requestAnimationFrame(updateScrollMetrics);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollMetrics);
      resizeObserver.disconnect();
    };
  }, [columns.length, cards.length, conversations.length]);

  return (
    <>
      <section className="crm-funnel-overlay">
        <div className="crm-funnel-panel crm-scrollbar">
          <div className="crm-funnel-header">
            <div>
              <p className="crm-funnel-kicker">Funil CRM</p>
              <h2 className="crm-funnel-title">Gerencie seu funil de vendas</h2>
              <p className="crm-funnel-subtitle">Gerencie seu funil de vendas</p>
            </div>
            <div className="crm-funnel-actions">
              <label className="crm-funnel-select-wrap">
                <span>Funil(s):</span>
                <select
                  className="crm-funnel-select"
                  value={selectedFunnelId}
                  onChange={(event) => onSelectFunnel(event.target.value)}
                >
                  {funnels.map((funnel) => (
                    <option key={funnel.id} value={funnel.id}>
                      {funnel.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="crm-funnel-btn crm-funnel-btn-primary" onClick={onCreateFunnel}>
                <Plus className="crm-h-4 crm-w-4" />
                Criar Funil
              </button>
              <input
                className="crm-funnel-search"
                placeholder="Buscar contatos..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="button" className="crm-funnel-btn crm-funnel-btn-secondary" onClick={onConfigureFunnel}>
                Configurar
              </button>
              <button type="button" className="crm-funnel-btn crm-funnel-btn-close" onClick={onClose}>
                <X className="crm-h-4 crm-w-4" />
                Fechar
              </button>
            </div>
          </div>

          <div ref={columnsRef} className="crm-funnel-columns crm-scrollbar">
            {showRecentConversations ? (
            <div className="crm-funnel-column crm-funnel-column-recent">
            <div className="crm-funnel-column-head">
              <div className="crm-funnel-column-title-wrap">
                <span className="crm-funnel-dot crm-funnel-dot-green" />
                <strong>Últimas Conversas</strong>
              </div>
              <span className="crm-funnel-count">{filteredConversations.length}</span>
            </div>
            <div className="crm-funnel-list crm-scrollbar">
              {filteredConversations.map((conversation) => (
                <article
                  key={conversation.id}
                  className="crm-funnel-card crm-funnel-card-accent"
                  draggable
                  onDragStart={() => setDraggedConversation(conversation)}
                  onDragEnd={() => setDraggedConversation(null)}
                >
                  <div className="crm-funnel-card-top">
                    <FunnelAvatar name={conversation.name} avatarUrl={conversation.avatarUrl} />
                    <div className="crm-min-w-0">
                      <h3 className="crm-funnel-card-name">{conversation.name}</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="crm-funnel-card-btn"
                    draggable={false}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenConversation(conversation);
                    }}
                  >
                    <MessageCircle className="crm-h-4 crm-w-4" />
                    Mensagem
                  </button>
                </article>
              ))}
            </div>
          </div>
            ) : null}

          {columns.map((column) => {
            const columnCards = cards.filter((card) => card.columnId === column.id);

            return (
              <div
                key={column.id}
                className="crm-funnel-column"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedColumnId && draggedColumnId !== column.id) {
                    onReorderColumns(draggedColumnId, column.id);
                    setDraggedColumnId(null);
                    return;
                  }

                  if (draggedConversation) {
                    onAssignConversation(draggedConversation, column.id);
                    setDraggedConversation(null);
                  }

                  if (draggedCardId) {
                    onMoveCard(draggedCardId, column.id);
                    setDraggedCardId(null);
                  }
                }}
              >
                <div className="crm-funnel-column-head">
                  <div className="crm-funnel-column-title-wrap">
                    <button
                      type="button"
                      className="crm-funnel-drag-handle"
                      title="Arraste para reordenar"
                      draggable={allowColumnManagement}
                      onDragStart={(event) => {
                        if (!allowColumnManagement) {
                          event.preventDefault();
                          return;
                        }
                        event.stopPropagation();
                        setDraggedColumnId(column.id);
                      }}
                      onDragEnd={() => setDraggedColumnId(null)}
                    >
                      ⋮⋮
                    </button>
                    <span className="crm-funnel-dot" style={{ backgroundColor: column.color }} />
                    <strong>{column.name}</strong>
                  </div>
                  <div className="crm-funnel-column-tools">
                    <span className="crm-funnel-count">{columnCards.length}</span>
                    {allowColumnManagement ? (
                      <>
                        <button type="button" className="crm-funnel-icon-btn" onClick={() => openEditModal(column)}>
                          <Settings className="crm-h-4 crm-w-4" />
                        </button>
                        <button type="button" className="crm-funnel-icon-btn" onClick={() => openDeleteModal(column)}>
                          <X className="crm-h-4 crm-w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="crm-funnel-list crm-scrollbar">
                  {columnCards.length ? (
                    columnCards.map((card) => (
                      <article
                        key={card.id}
                        className="crm-funnel-card"
                        draggable
                        onDragStart={() => setDraggedCardId(card.id)}
                        onDragEnd={() => setDraggedCardId(null)}
                      >
                        <div className="crm-funnel-card-top">
                          <FunnelAvatar name={card.name} avatarUrl={card.avatarUrl} />
                          <div className="crm-min-w-0 crm-funnel-card-main">
                            <h3 className="crm-funnel-card-name">{card.name}</h3>
                            {card.latestOrder?.productName ? (
                              <p className="crm-funnel-card-meta">{card.latestOrder.productName}</p>
                            ) : null}
                            {card.source ? <p className="crm-funnel-card-meta">{card.source}</p> : null}
                            {card.tags?.length ? (
                              <div className="crm-funnel-card-tags">
                                {card.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="crm-funnel-card-tag"
                                    style={{
                                      borderColor: `${tag.color ?? '#334155'}55`,
                                      color: tag.color ?? '#cbd5e1'
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {allowColumnManagement ? (
                            <button
                              type="button"
                              className="crm-funnel-card-remove"
                              title="Remover contato"
                              onClick={() => onRemoveCard(card.id)}
                            >
                              <X className="crm-h-4 crm-w-4" />
                            </button>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="crm-funnel-card-btn"
                          draggable={false}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenConversation(card);
                          }}
                        >
                          <MessageCircle className="crm-h-4 crm-w-4" />
                          Mensagem
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="crm-funnel-empty">
                      <p>Arraste contatos aqui</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

            {allowCreateStages ? (
            <div className="crm-funnel-column crm-funnel-column-create">
              <div className="crm-funnel-column-head">
                <strong>Criar Nova Etapa</strong>
              </div>
              <div className="crm-funnel-create-wrap">
                <button type="button" className="crm-funnel-create-btn" onClick={openCreateModal}>
                  <Plus className="crm-h-7 crm-w-7" />
                  Criar Nova Etapa
                </button>
              </div>
            </div>
            ) : null}
          </div>

          {maxScrollLeft > 0 ? (
            <div className="crm-funnel-scrollbar-shell">
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.round(maxScrollLeft))}
                value={Math.round(scrollLeft)}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setScrollLeft(nextValue);
                  columnsRef.current?.scrollTo({ left: nextValue, behavior: 'auto' });
                }}
                className="crm-funnel-scrollbar-range"
                aria-label="Rolagem horizontal das colunas"
              />
            </div>
          ) : null}
        </div>
      </section>

      {modal ? (
        <div className="crm-modal-backdrop">
          <div className="crm-modal-card">
            <div className="crm-modal-header">
              <h3>
                {modal.type === 'create'
                  ? 'Nueva Lista'
                  : modal.type === 'edit'
                    ? 'Editar Lista'
                    : 'Excluir Etapa'}
              </h3>
              <button type="button" className="crm-modal-close" onClick={() => setModal(null)}>
                <X className="crm-h-5 crm-w-5" />
              </button>
            </div>

            <div className="crm-modal-body">
              {modal.type === 'delete' ? (
                <div className="crm-modal-confirm">
                  <p>
                    Tem certeza que deseja excluir a etapa <strong>{modal.column.name}</strong>?
                  </p>
                  <span>Os contatos movidos para ela serão removidos dessa etapa.</span>
                </div>
              ) : (
                <label className="crm-modal-label">
                  <span>Nome da etapa</span>
                  <input
                    value={formName}
                    onChange={(event) => setFormName(event.target.value)}
                    placeholder="Ex: Leads, Clientes, Prospectos..."
                    className="crm-modal-input"
                  />
                </label>
              )}

              {modal.type !== 'delete' ? (
                <label className="crm-modal-label">
                  <span>Cor da etapa</span>
                  <div className="crm-modal-color-row">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(event) => setFormColor(event.target.value)}
                      className="crm-modal-color"
                    />
                    <input
                      value={formColor}
                      onChange={(event) => setFormColor(event.target.value)}
                      className="crm-modal-input"
                    />
                  </div>
                </label>
              ) : null}
            </div>

            <div className="crm-modal-footer">
              {modal.type === 'edit' ? (
                <button
                  type="button"
                  className="crm-modal-danger"
                  onClick={() => openDeleteModal(modal.column)}
                >
                  Eliminar Lista
                </button>
              ) : null}
              <button type="button" className="crm-modal-secondary" onClick={() => setModal(null)}>
                {modal.type === 'delete' ? 'Não' : 'Cancelar'}
              </button>
              <button
                type="button"
                className={modal.type === 'delete' ? 'crm-modal-danger-confirm' : 'crm-modal-primary'}
                onClick={submitModal}
              >
                {modal.type === 'create' ? 'Criar Etapa' : modal.type === 'edit' ? 'Salvar' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
