import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { WorkspaceTag } from '../../shared/types';

interface TagPickerProps {
  availableTags: WorkspaceTag[];
  currentTagIds: string[];
  onPick(tag: { name: string; color?: string }): void;
}

export function TagPicker({ availableTags, currentTagIds, onPick }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  const unusedTags = availableTags.filter((tag) => !currentTagIds.includes(tag.id));

  const submitCustom = () => {
    if (!customName.trim()) return;
    onPick({ name: customName.trim() });
    setCustomName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="crm-funnel-card-tag crm-funnel-card-tag-add"
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Plus className="crm-h-2.5 crm-w-2.5" />
        tag
      </button>
    );
  }

  // Rendered inline (no portal, no position:fixed/absolute) so it can
  // never end up clipped by a scrolling ancestor or fighting with
  // backdrop-filter containing blocks — it just takes up normal flow space
  // below the tags row, same as any other card content.
  return (
    <div
      className="crm-tag-picker-inline"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="crm-tag-picker-inline-header">
        <span>Adicionar tag</span>
        <button
          type="button"
          className="crm-tag-picker-inline-close"
          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
        >
          <X className="crm-h-3 crm-w-3" />
        </button>
      </div>
      {unusedTags.length ? (
        <div className="crm-tag-picker-inline-options">
          {unusedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="crm-rounded-full crm-border crm-px-2 crm-py-1 crm-text-[11px] crm-font-semibold"
              style={{ borderColor: `${tag.color ?? '#334155'}55`, color: tag.color ?? '#cbd5e1' }}
              onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPick({ name: tag.name, color: tag.color ?? undefined });
                setOpen(false);
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="crm-tag-picker-inline-empty">Nenhuma tag existente.</p>
      )}
      <div className="crm-tag-picker-inline-custom">
        <input
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
          placeholder="Nova tag..."
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitCustom();
          }}
        />
        <button
          type="button"
          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submitCustom();
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
