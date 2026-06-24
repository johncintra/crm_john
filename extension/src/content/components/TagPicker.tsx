import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { WorkspaceTag } from '../../shared/types';

interface TagPickerProps {
  availableTags: WorkspaceTag[];
  currentTagIds: string[];
  onPick(tag: { name: string; color?: string }): void;
}

export function TagPicker({ availableTags, currentTagIds, onPick }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const unusedTags = availableTags.filter((tag) => !currentTagIds.includes(tag.id));

  const submitCustom = () => {
    if (!customName.trim()) return;
    onPick({ name: customName.trim() });
    setCustomName('');
    setOpen(false);
  };

  return (
    <div className="crm-relative crm-inline-block" ref={containerRef}>
      <button
        type="button"
        className="crm-funnel-card-tag crm-funnel-card-tag-add"
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <Plus className="crm-h-2.5 crm-w-2.5" />
        tag
      </button>

      {open ? (
        <div
          className="crm-absolute crm-left-0 crm-top-full crm-z-50 crm-mt-1 crm-w-56 crm-rounded-2xl crm-border crm-border-white/10 crm-bg-slate-950 crm-p-2.5 crm-shadow-2xl"
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
        </div>
      ) : null}
    </div>
  );
}
