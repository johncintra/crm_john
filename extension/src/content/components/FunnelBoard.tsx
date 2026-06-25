import { Copy, MessageCircle, Plus, Settings, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency } from '../../shared/utils';
import type { WorkspaceTag } from '../../shared/types';
import { TagPicker } from './TagPicker';
import type { WhatsAppConversationItem } from '../whatsapp';

const LOST_TAG_NAME = 'perdido';

export interface FunnelColumn {
  id: string;
  name: string;
  color: string;
}

export interface FunnelCard {
  id: string;
  name: string;
  email?: string | null;
  phone: string | null;
  normalizedPhone?: string | null;
  avatarUrl: string | null;
  columnId: string;
  leadId?: string;
  source?: string | null;
  temperature?: string | null;
  wasCheckoutOpportunity?: boolean;
  // True for regular CRM cards pinned into Compra Aprovada via the
  // "aprovado" tag rather than via checkout data — not draggable out of
  // the pinned column, since removing/swapping the tag is the correction.
  pinnedViaTag?: boolean;
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

export interface PinnedCardColumn {
  id: string;
  title: string;
  color: string;
  cards: FunnelCard[];
}

interface FunnelBoardProps {
  funnelName: string;
  funnels: Array<{ id: string; name: string }>;
  selectedFunnelId: string;
  conversations: WhatsAppConversationItem[];
  columns: FunnelColumn[];
  cards: FunnelCard[];
  pinnedCardColumns?: PinnedCardColumn[];
  pinnedCardColumnsEnd?: PinnedCardColumn[];
  onSelectFunnel: (funnelId: string) => void;
  onCreateFunnel: () => void;
  onConfigureFunnel: () => void;
  onCopyEmail?: (email: string) => void;
  onOpenConversation: (conversation: { name: string; phone: string | null; normalizedPhone?: string | null; leadId?: string }) => void | Promise<void>;
  onAssignConversation: (conversation: WhatsAppConversationItem, columnId: string) => void | Promise<void>;
  onAssignPinnedCard?: (card: FunnelCard, columnId: string) => void | Promise<void>;
  onUpdateCardEmail?: (leadId: string, email: string) => void;
  onAddCardTag?: (leadId: string, name: string) => void;
  onRemoveCardTag?: (leadId: string, tagId: string) => void;
  availableTags?: WorkspaceTag[];
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
  compactCheckoutCards?: boolean;
}

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; column: FunnelColumn }
  | { type: 'delete'; column: FunnelColumn }
  | null;

function getOrderStatusColor(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': return '#22c55e';
    case 'DECLINED': return '#ef4444';
    case 'PENDING': return '#06b6d4';
    case 'REFUNDED': return '#f59e0b';
    case 'CHARGEBACK': return '#7c3aed';
    case 'ABANDONED': return '#94a3b8';
    default: return '#334155';
  }
}

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
  pinnedCardColumns = [],
  pinnedCardColumnsEnd = [],
  onSelectFunnel,
  onCreateFunnel,
  onConfigureFunnel,
  onCopyEmail,
  onOpenConversation,
  onAssignConversation,
  onAssignPinnedCard,
  onUpdateCardEmail,
  onAddCardTag,
  onRemoveCardTag,
  availableTags = [],
  onMoveCard,
  onRemoveCard,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onReorderColumns,
  onClose,
  showRecentConversations = true,
  allowColumnManagement = true,
  allowCreateStages = true,
  compactCheckoutCards = false
}: FunnelBoardProps) {
  const [search, setSearch] = useState('');
  const [draggedConversation, setDraggedConversation] = useState<WhatsAppConversationItem | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedPinnedCard, setDraggedPinnedCard] = useState<FunnelCard | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#047515');
  const [maxScrollLeft, setMaxScrollLeft] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const columnsRef = useRef<HTMLDivElement | null>(null);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!normalizedSearch) return conversations;
    return conversations.filter((item) => {
      const text = `${item.name} ${item.phone ?? ''}`.toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [conversations, normalizedSearch]);

  const matchesSearch = (card: FunnelCard) => {
    // "Perdido" cards stay invisible everywhere until the seller clicks
    // that exact tag filter — same idea as "aprovado" pinning into Compra
    // Aprovada, but here there's no other column to show them in, so the
    // tag filter row is the only way back to them.
    const isLost = (card.tags ?? []).some((tag) => tag.name.trim().toLowerCase() === LOST_TAG_NAME);
    if (isLost && normalizedSearch !== LOST_TAG_NAME) return false;

    if (!normalizedSearch) return true;
    const tagsText = (card.tags ?? []).map((tag) => tag.name).join(' ');
    const text = `${card.name} ${card.email ?? ''} ${card.phone ?? ''} ${tagsText}`.toLowerCase();
    return text.includes(normalizedSearch);
  };

  const filteredCards = useMemo(() => cards.filter(matchesSearch), [cards, normalizedSearch]);

  const filteredPinnedColumns = useMemo(
    () => pinnedCardColumns.map((column) => ({ ...column, cards: column.cards.filter(matchesSearch) })),
    [pinnedCardColumns, normalizedSearch]
  );

  const filteredPinnedColumnsEnd = useMemo(
    () => pinnedCardColumnsEnd.map((column) => ({ ...column, cards: column.cards.filter(matchesSearch) })),
    [pinnedCardColumnsEnd, normalizedSearch]
  );

  const renderCard = (
    card: FunnelCard,
    columnColor: string,
    options: { draggable: boolean; allowRemove: boolean; onDragStart: () => void }
  ) => {
    const statusColor = getOrderStatusColor(card.latestOrder?.status);

    return (
      <article
        key={card.id}
        className="crm-funnel-card"
        draggable={options.draggable}
        onDragStart={options.onDragStart}
        onDragEnd={() => { setDraggedCardId(null); setDraggedPinnedCard(null); }}
      >
        {/* Colored status bar at top */}
        <div className="crm-funnel-card-bar" style={{ background: statusColor }} />
        {/* Stage-colored side bar (wacrm-style) */}
        <div className="crm-funnel-card-side-bar" style={{ background: columnColor }} />

        <div className="crm-funnel-card-top">
          <FunnelAvatar name={card.name} avatarUrl={card.avatarUrl} />
          <div className="crm-min-w-0 crm-funnel-card-main">
            <div className="crm-funnel-card-name-row">
              <h3 className="crm-funnel-card-name">{card.name}</h3>
            </div>

            {/* Email row — always rendered, "N/D" when missing, so every
                card (checkout-sourced or added straight from a chat) uses
                the same layout. Editable when missing, so the seller can
                fill it in later. */}
            <div className="crm-funnel-card-email-row">
              <p className={card.email ? 'crm-funnel-card-email' : 'crm-funnel-card-email crm-funnel-card-email-empty'}>
                {card.email ?? 'E-mail: N/D'}
              </p>
              {card.email && onCopyEmail ? (
                <button
                  type="button"
                  className="crm-funnel-card-email-copy"
                  title="Copiar email"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onCopyEmail(card.email!);
                  }}
                >
                  <Copy className="crm-h-3 crm-w-3" />
                </button>
              ) : null}
              {!card.email && card.leadId && onUpdateCardEmail ? (
                <button
                  type="button"
                  className="crm-funnel-card-email-copy"
                  title="Adicionar email"
                  onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const value = window.prompt(`E-mail de ${card.name}:`)?.trim();
                    if (value) onUpdateCardEmail(card.leadId!, value);
                  }}
                >
                  <Plus className="crm-h-3 crm-w-3" />
                </button>
              ) : null}
            </div>

            {card.phone ? <p className="crm-funnel-card-phone">{card.phone}</p> : null}

            {/* Amount — visible whenever the card carries order data (checkout-sourced) */}
            {card.latestOrder ? (
              <p className="crm-funnel-card-amount">
                {formatCurrency(card.latestOrder.amount, card.latestOrder.currency)}
                {card.latestOrder.productName ? (
                  <span className="crm-funnel-card-amount-product"> · {card.latestOrder.productName}</span>
                ) : null}
              </p>
            ) : null}

            {!card.latestOrder && card.source ? (
              <p className="crm-funnel-card-meta">{card.source}</p>
            ) : null}

            <div className="crm-funnel-card-tags">
              {card.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="crm-funnel-card-tag"
                  style={{
                    borderColor: `${tag.color ?? '#334155'}55`,
                    color: tag.color ?? '#cbd5e1'
                  }}
                >
                  {tag.name}
                  {card.leadId && onRemoveCardTag ? (
                    <button
                      type="button"
                      className="crm-funnel-card-tag-remove"
                      title="Remover tag"
                      onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemoveCardTag(card.leadId!, tag.id);
                      }}
                    >
                      <X className="crm-h-2.5 crm-w-2.5" />
                    </button>
                  ) : null}
                </span>
              ))}
              {card.leadId && onAddCardTag ? (
                <TagPicker
                  availableTags={availableTags}
                  currentTagIds={(card.tags ?? []).map((tag) => tag.id)}
                  onPick={(tag) => onAddCardTag(card.leadId!, tag.name)}
                />
              ) : null}
            </div>
          </div>

          {options.allowRemove ? (
            <button
              type="button"
              className="crm-funnel-card-remove"
              title="Remover contato"
              onClick={() => {
                const confirmed = window.confirm(`Deseja remover "${card.name}" desta etapa?`);
                if (confirmed) onRemoveCard(card.id);
              }}
            >
              <X className="crm-h-3.5 crm-w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="crm-funnel-card-actions">
          <button
            type="button"
            className="crm-funnel-card-btn-msg"
            draggable={false}
            onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenConversation(card);
            }}
          >
            <MessageCircle className="crm-h-3.5 crm-w-3.5" />
            Mensagem
          </button>
        </div>
      </article>
    );
  };

  const renderPinnedColumn = (pinnedColumn: PinnedCardColumn & { cards: FunnelCard[] }) => {
    const columnTotal = pinnedColumn.cards.reduce((sum, card) => sum + (card.latestOrder?.amount ?? 0), 0);

    return (
      <div
        key={pinnedColumn.id}
        className="crm-funnel-column crm-funnel-column-recent"
        style={{ borderTopColor: pinnedColumn.color }}
      >
        <div className="crm-funnel-column-head">
          <div className="crm-funnel-column-title-wrap">
            <span className="crm-funnel-dot" style={{ backgroundColor: pinnedColumn.color }} />
            <strong>{pinnedColumn.title}</strong>
            {columnTotal > 0 ? (
              <span className="crm-funnel-column-total">
                {formatCurrency(columnTotal, pinnedColumn.cards[0]?.latestOrder?.currency ?? 'BRL')}
              </span>
            ) : null}
          </div>
          <span className="crm-funnel-count">{pinnedColumn.cards.length}</span>
        </div>
        <div className="crm-funnel-list crm-scrollbar">
          {pinnedColumn.cards.length ? (
            pinnedColumn.cards.map((card) =>
              renderCard(card, pinnedColumn.color, {
                draggable: !card.pinnedViaTag,
                allowRemove: false,
                onDragStart: card.pinnedViaTag ? () => undefined : () => setDraggedPinnedCard(card)
              })
            )
          ) : (
            <div className="crm-funnel-empty">
              <p>Nenhum lead aqui</p>
            </div>
          )}
        </div>
      </div>
    );
  };

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

    if (!formName.trim()) return;

    if (modal?.type === 'create') onCreateColumn({ name: formName.trim(), color: formColor });
    if (modal?.type === 'edit') onUpdateColumn({ id: modal.column.id, name: formName.trim(), color: formColor });

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
    if (!element) return;

    const handleScroll = () => setScrollLeft(element.scrollLeft);
    element.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollMetrics);
    const resizeObserver = new ResizeObserver(() => updateScrollMetrics());
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

          {/* ── Header ── */}
          {/* Left: funnel identity + global actions. Right: funnel
              switcher/search/tag-filters, stacked in their own column. The
              two sides never mix — keep new header controls in the side
              that already matches their purpose instead of restructuring
              this again. */}
          <div className="crm-funnel-header">
            <div className="crm-funnel-title-row">
              <div>
                <p className="crm-funnel-kicker">xCore CRM</p>
                <h2 className="crm-funnel-title">{funnelName}</h2>
                <p className="crm-funnel-subtitle">
                  {cards.length} lead{cards.length !== 1 ? 's' : ''} · {columns.length} etapa{columns.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button type="button" className="crm-funnel-btn crm-funnel-btn-whatsapp" onClick={onClose}>
                <MessageCircle className="crm-h-4 crm-w-4" />
                Conversas
              </button>
              <button type="button" className="crm-funnel-btn crm-funnel-btn-secondary" onClick={onConfigureFunnel}>
                Configurar
              </button>
            </div>

            <div className="crm-funnel-header-right">
              <div className="crm-funnel-header-right-top">
                <label className="crm-funnel-select-wrap">
                  <span>Funil:</span>
                  <select
                    className="crm-funnel-select"
                    value={selectedFunnelId}
                    onChange={(event) => onSelectFunnel(event.target.value)}
                  >
                    {funnels.map((funnel) => (
                      <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="crm-funnel-btn crm-funnel-btn-primary" onClick={onCreateFunnel}>
                  <Plus className="crm-h-4 crm-w-4" />
                  Criar Funil
                </button>
              </div>
              <input
                className="crm-funnel-search"
                placeholder="Buscar contatos..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {availableTags.length ? (
                <div className="crm-funnel-tag-filters">
                  {availableTags.map((tag) => {
                    const isActive = normalizedSearch === tag.name.trim().toLowerCase();
                    const tagColor = tag.color ?? '#334155';
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className="crm-funnel-card-tag crm-funnel-tag-filter"
                        style={
                          isActive
                            ? { borderColor: tagColor, backgroundColor: tagColor, color: '#0b1120' }
                            : { borderColor: `${tagColor}55`, color: tagColor }
                        }
                        onClick={() => setSearch(isActive ? '' : tag.name)}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Columns ── */}
          <div ref={columnsRef} className="crm-funnel-columns crm-scrollbar">

            {/* Recent conversations column */}
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
                        <div className="crm-min-w-0 crm-funnel-card-main">
                          <div className="crm-funnel-card-name-row">
                            <h3 className="crm-funnel-card-name">{conversation.name}</h3>
                          </div>
                          {conversation.phone ? (
                            <p className="crm-funnel-card-meta">{conversation.phone}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="crm-funnel-card-actions">
                        <button
                          type="button"
                          className="crm-funnel-card-btn-msg"
                          draggable={false}
                          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenConversation(conversation);
                          }}
                        >
                          <MessageCircle className="crm-h-3.5 crm-w-3.5" />
                          Mensagem
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Pinned checkout-sourced columns shown first (e.g. Oportunidades) */}
            {filteredPinnedColumns.map(renderPinnedColumn)}

            {/* CRM columns */}
            {columns.map((column) => {
              const columnCards = filteredCards.filter((card) => card.columnId === column.id);
              const columnTotal = columnCards.reduce((sum, card) => sum + (card.latestOrder?.amount ?? 0), 0);

              return (
                <div
                  key={column.id}
                  className="crm-funnel-column"
                  style={{ borderTopColor: column.color }}
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
                    if (draggedPinnedCard && onAssignPinnedCard) {
                      void onAssignPinnedCard(draggedPinnedCard, column.id);
                      setDraggedPinnedCard(null);
                    }
                    if (draggedCardId && !compactCheckoutCards) {
                      onMoveCard(draggedCardId, column.id);
                      setDraggedCardId(null);
                    }
                  }}
                >
                  <div
                    className="crm-funnel-column-head"
                    style={{ background: `linear-gradient(135deg, ${column.color}1e 0%, transparent 65%)` }}
                  >
                    <div className="crm-funnel-column-title-wrap">
                      <button
                        type="button"
                        className="crm-funnel-drag-handle"
                        title="Arraste para reordenar"
                        draggable={allowColumnManagement}
                        onDragStart={(event) => {
                          if (!allowColumnManagement) { event.preventDefault(); return; }
                          event.stopPropagation();
                          setDraggedColumnId(column.id);
                        }}
                        onDragEnd={() => setDraggedColumnId(null)}
                      >
                        ⋮⋮
                      </button>
                      <span className="crm-funnel-dot" style={{ backgroundColor: column.color, boxShadow: `0 0 6px ${column.color}80` }} />
                      <strong>{column.name}</strong>
                      {columnTotal > 0 ? (
                        <span className="crm-funnel-column-total">{formatCurrency(columnTotal, columnCards[0]?.latestOrder?.currency ?? 'BRL')}</span>
                      ) : null}
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
                      columnCards.map((card) =>
                        renderCard(card, column.color, {
                          draggable: !compactCheckoutCards,
                          allowRemove: allowColumnManagement,
                          onDragStart: () => { if (!compactCheckoutCards) setDraggedCardId(card.id); }
                        })
                      )
                    ) : (
                      <div className="crm-funnel-empty">
                        <p>Arraste contatos aqui</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pinned checkout-sourced columns shown last (e.g. Compra Aprovada) */}
            {filteredPinnedColumnsEnd.map(renderPinnedColumn)}

            {/* Create column */}
            {allowCreateStages ? (
              <div className="crm-funnel-column crm-funnel-column-create">
                <div className="crm-funnel-column-head">
                  <strong>Nova Etapa</strong>
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

          {/* Scroll range */}
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

      {/* ── Modal ── */}
      {modal ? (
        <div className="crm-modal-backdrop">
          <div className="crm-modal-card">
            <div className="crm-modal-header">
              <h3>
                {modal.type === 'create' ? 'Nova Etapa' : modal.type === 'edit' ? 'Editar Etapa' : 'Excluir Etapa'}
              </h3>
              <button type="button" className="crm-modal-close" onClick={() => setModal(null)}>
                <X className="crm-h-5 crm-w-5" />
              </button>
            </div>

            <div className="crm-modal-body">
              {modal.type === 'delete' ? (
                <div className="crm-modal-confirm">
                  <p>Tem certeza que deseja excluir a etapa <strong>{modal.column.name}</strong>?</p>
                  <span>Os contatos nela serão removidos da etapa.</span>
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
                <button type="button" className="crm-modal-danger" onClick={() => openDeleteModal(modal.column)}>
                  Excluir Etapa
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
                {modal.type === 'create' ? 'Criar' : modal.type === 'edit' ? 'Salvar' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
