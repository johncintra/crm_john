import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Macro } from '../../shared/types';

interface MacroManagerModalProps {
  macros: Macro[];
  onClose(): void;
  onCreate(shortcut: string, content: string): void;
  onUpdate(macroId: string, shortcut: string, content: string): void;
  onDelete(macroId: string): void;
}

export function MacroManagerModal({ macros, onClose, onCreate, onUpdate, onDelete }: MacroManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');

  const startCreate = () => {
    setEditingId('new');
    setShortcut('');
    setContent('');
  };

  const startEdit = (macro: Macro) => {
    setEditingId(macro.id);
    setShortcut(macro.shortcut);
    setContent(macro.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShortcut('');
    setContent('');
  };

  const submit = () => {
    const trimmedShortcut = shortcut.trim().replace(/^\/+/, '');
    const trimmedContent = content.trim();
    if (!trimmedShortcut || !trimmedContent) return;

    if (editingId === 'new') {
      onCreate(trimmedShortcut, trimmedContent);
    } else if (editingId) {
      onUpdate(editingId, trimmedShortcut, trimmedContent);
    }
    cancelEdit();
  };

  return (
    <div className="crm-fixed crm-inset-0 crm-z-50 crm-flex crm-items-center crm-justify-center crm-bg-black/50 crm-p-4">
      <div className="crm-w-full crm-max-w-md crm-rounded-3xl crm-border crm-border-white/10 crm-bg-slate-950 crm-shadow-2xl">
        <div className="crm-flex crm-items-center crm-justify-between crm-border-b crm-border-white/8 crm-px-5 crm-py-4">
          <div>
            <p className="crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-accent-300">Macros</p>
            <h3 className="crm-mt-0.5 crm-text-sm crm-font-semibold crm-text-white">Atalhos de mensagem (/atalho)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="crm-rounded-full crm-border crm-border-white/10 crm-p-1.5 crm-text-slate-400 hover:crm-text-white"
          >
            <X className="crm-h-4 crm-w-4" />
          </button>
        </div>

        <div className="crm-max-h-96 crm-space-y-2 crm-overflow-y-auto crm-px-5 crm-py-4 crm-scrollbar">
          {macros.length === 0 && editingId !== 'new' ? (
            <p className="crm-py-4 crm-text-center crm-text-sm crm-text-slate-500">
              Nenhuma macro ainda. Crie a primeira abaixo.
            </p>
          ) : null}

          {macros.map((macro) => (
            <div key={macro.id} className="crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/[0.03] crm-p-3">
              {editingId === macro.id ? (
                <div className="crm-space-y-2">
                  <input
                    value={shortcut}
                    onChange={(event) => setShortcut(event.target.value)}
                    placeholder="atalho (sem a barra)"
                    className="crm-w-full crm-rounded-lg crm-border crm-border-white/10 crm-bg-black/30 crm-px-2 crm-py-1.5 crm-text-xs crm-text-white"
                  />
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Mensagem completa"
                    rows={3}
                    className="crm-w-full crm-rounded-lg crm-border crm-border-white/10 crm-bg-black/30 crm-px-2 crm-py-1.5 crm-text-xs crm-text-white"
                  />
                  <div className="crm-flex crm-justify-end crm-gap-2">
                    <button type="button" className="crm-text-xs crm-text-slate-400" onClick={cancelEdit}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="crm-rounded-lg crm-bg-primary crm-px-3 crm-py-1.5 crm-text-xs crm-font-semibold crm-text-white"
                      onClick={submit}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="crm-flex crm-items-start crm-justify-between crm-gap-2">
                  <div className="crm-min-w-0">
                    <p className="crm-text-sm crm-font-semibold crm-text-accent-300">/{macro.shortcut}</p>
                    <p className="crm-mt-0.5 crm-truncate crm-text-xs crm-text-slate-400">{macro.content}</p>
                  </div>
                  <div className="crm-flex crm-shrink-0 crm-gap-1">
                    <button
                      type="button"
                      className="crm-rounded-full crm-p-1.5 crm-text-slate-400 hover:crm-text-white"
                      onClick={() => startEdit(macro)}
                    >
                      <Pencil className="crm-h-3.5 crm-w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="crm-rounded-full crm-p-1.5 crm-text-slate-400 hover:crm-text-rose-400"
                      onClick={() => onDelete(macro.id)}
                    >
                      <Trash2 className="crm-h-3.5 crm-w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {editingId === 'new' ? (
            <div className="crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/[0.03] crm-p-3">
              <div className="crm-space-y-2">
                <input
                  autoFocus
                  value={shortcut}
                  onChange={(event) => setShortcut(event.target.value)}
                  placeholder="atalho (sem a barra), ex: bomdia"
                  className="crm-w-full crm-rounded-lg crm-border crm-border-white/10 crm-bg-black/30 crm-px-2 crm-py-1.5 crm-text-xs crm-text-white"
                />
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Mensagem completa"
                  rows={3}
                  className="crm-w-full crm-rounded-lg crm-border crm-border-white/10 crm-bg-black/30 crm-px-2 crm-py-1.5 crm-text-xs crm-text-white"
                />
                <div className="crm-flex crm-justify-end crm-gap-2">
                  <button type="button" className="crm-text-xs crm-text-slate-400" onClick={cancelEdit}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="crm-rounded-lg crm-bg-primary crm-px-3 crm-py-1.5 crm-text-xs crm-font-semibold crm-text-white"
                    onClick={submit}
                  >
                    Criar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {editingId !== 'new' ? (
          <div className="crm-border-t crm-border-white/8 crm-px-5 crm-py-3">
            <button
              type="button"
              className="crm-flex crm-w-full crm-items-center crm-justify-center crm-gap-1.5 crm-rounded-xl crm-border crm-border-dashed crm-border-white/15 crm-py-2 crm-text-xs crm-font-semibold crm-text-slate-300 hover:crm-text-white"
              onClick={startCreate}
            >
              <Plus className="crm-h-3.5 crm-w-3.5" />
              Nova macro
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
