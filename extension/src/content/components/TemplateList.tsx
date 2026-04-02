import { Clipboard, SendHorizontal } from 'lucide-react';
import type { MessageTemplate } from '../../shared/types';

interface TemplateListProps {
  templates: MessageTemplate[];
  onCopy(template: MessageTemplate): void;
  onInsert(template: MessageTemplate): void;
}

export function TemplateList({ templates, onCopy, onInsert }: TemplateListProps) {
  return (
    <div className="crm-space-y-3">
      {templates.map((template) => (
        <article
          key={template.id}
          className="crm-rounded-2xl crm-border crm-border-white/8 crm-bg-white/[0.04] crm-p-3"
        >
          <div className="crm-flex crm-items-start crm-justify-between crm-gap-3">
            <div>
              <h3 className="crm-text-sm crm-font-medium crm-text-white">{template.title}</h3>
              <span className="crm-mt-1 crm-inline-flex crm-rounded-full crm-border crm-border-cyan-400/15 crm-bg-cyan-400/10 crm-px-2.5 crm-py-1 crm-text-[10px] crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-cyan-200">
                {template.category}
              </span>
            </div>
          </div>
          <p className="crm-mt-3 crm-line-clamp-3 crm-text-sm crm-leading-6 crm-text-slate-300">
            {template.content}
          </p>
          <div className="crm-mt-4 crm-flex crm-gap-2">
            <button
              type="button"
              onClick={() => onCopy(template)}
              className="crm-flex-1 crm-rounded-xl crm-border crm-border-white/10 crm-bg-black/20 crm-px-3 crm-py-2.5 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-slate-200 transition hover:crm-border-accent-500/30 hover:crm-text-white"
            >
              <span className="crm-inline-flex crm-items-center crm-gap-2">
                <Clipboard className="crm-h-4 crm-w-4" />
                Copiar
              </span>
            </button>
            <button
              type="button"
              onClick={() => onInsert(template)}
              className="crm-flex-1 crm-rounded-xl crm-border crm-border-accent-500/30 crm-bg-accent-500/10 crm-px-3 crm-py-2.5 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-accent-300 transition hover:crm-bg-accent-500/15"
            >
              <span className="crm-inline-flex crm-items-center crm-gap-2">
                <SendHorizontal className="crm-h-4 crm-w-4" />
                Inserir
              </span>
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
