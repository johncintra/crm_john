import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import type { WorkspaceTag } from '../../shared/types';

interface TagPickerProps {
  availableTags: WorkspaceTag[];
  currentTagIds: string[];
  onPick(tag: { name: string; color?: string }): void;
}

const POPOVER_WIDTH = 224;
const VIEWPORT_MARGIN = 8;

export function TagPicker({ availableTags, currentTagIds, onPick }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Note: deliberately NOT closing on scroll — WhatsApp Web's own chat
    // panes scroll/auto-adjust on their own (new messages, virtualization),
    // which with a window-level capture listener closed this popover
    // within milliseconds of opening it, before a click could land.
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  // Rendered in a portal at a JS-computed fixed position instead of a
  // CSS-absolute popover, because the card column scrolls vertically
  // (overflow-y: auto), which also clips horizontal overflow in Chrome —
  // an absolutely-positioned popover near the column's edge got cut off.
  const openPicker = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = rect.left;
    if (left + POPOVER_WIDTH + VIEWPORT_MARGIN > window.innerWidth) {
      left = Math.max(VIEWPORT_MARGIN, rect.right - POPOVER_WIDTH);
    }
    setPosition({ top: rect.bottom + 4, left });
    setOpen(true);
  };

  const unusedTags = availableTags.filter((tag) => !currentTagIds.includes(tag.id));

  const submitCustom = () => {
    if (!customName.trim()) return;
    onPick({ name: customName.trim() });
    setCustomName('');
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="crm-funnel-card-tag crm-funnel-card-tag-add"
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            openPicker();
          }
        }}
      >
        <Plus className="crm-h-2.5 crm-w-2.5" />
        tag
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popoverRef}
              style={{ position: 'fixed', top: position.top, left: position.left, width: POPOVER_WIDTH }}
              className="crm-z-[9999] crm-rounded-2xl crm-border crm-border-white/10 crm-bg-slate-950 crm-p-2.5 crm-shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {unusedTags.length ? (
                <div className="crm-mb-2 crm-flex crm-max-h-32 crm-flex-wrap crm-gap-1.5 crm-overflow-y-auto">
                  {unusedTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className="crm-rounded-full crm-border crm-px-2 crm-py-1 crm-text-[11px] crm-font-semibold"
                      style={{ borderColor: `${tag.color ?? '#334155'}55`, color: tag.color ?? '#cbd5e1' }}
                      onClick={() => {
                        onPick({ name: tag.name, color: tag.color ?? undefined });
                        setOpen(false);
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="crm-mb-2 crm-text-[11px] crm-text-slate-500">Nenhuma tag existente.</p>
              )}
              <div className="crm-flex crm-gap-1.5">
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder="Nova tag..."
                  className="crm-min-w-0 crm-flex-1 crm-rounded-lg crm-border crm-border-white/10 crm-bg-black/30 crm-px-2 crm-py-1.5 crm-text-xs crm-text-white placeholder:crm-text-slate-500 focus:crm-outline-none"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitCustom();
                  }}
                />
                <button
                  type="button"
                  className="crm-rounded-lg crm-bg-primary crm-px-2.5 crm-py-1.5 crm-text-xs crm-font-semibold crm-text-white"
                  onClick={submitCustom}
                >
                  OK
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
