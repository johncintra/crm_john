import { X } from 'lucide-react';
import type { RemoteLeadMessage } from '../../shared/types';

interface MessageHistoryPanelProps {
  leadName: string;
  messages: RemoteLeadMessage[];
  onClose(): void;
}

export function MessageHistoryPanel({ leadName, messages, onClose }: MessageHistoryPanelProps) {
  return (
    <div className="crm-fixed crm-inset-0 crm-z-50 crm-flex crm-items-end crm-justify-center crm-bg-black/40 crm-p-4">
      <div className="crm-w-full crm-max-w-sm crm-rounded-3xl crm-border crm-border-white/10 crm-bg-slate-950 crm-shadow-2xl">
        <div className="crm-flex crm-items-center crm-justify-between crm-border-b crm-border-white/8 crm-px-4 crm-py-3">
          <div>
            <p className="crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-accent-300">
              Conversa recente
            </p>
            <h3 className="crm-mt-0.5 crm-text-sm crm-font-semibold crm-text-white">{leadName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="crm-rounded-full crm-border crm-border-white/10 crm-p-1.5 crm-text-slate-400 hover:crm-text-white"
          >
            <X className="crm-h-4 crm-w-4" />
          </button>
        </div>

        <div className="crm-max-h-72 crm-space-y-2 crm-overflow-y-auto crm-px-4 crm-py-3 crm-scrollbar">
          {messages.length === 0 ? (
            <p className="crm-py-6 crm-text-center crm-text-sm crm-text-slate-500">
              Nenhuma mensagem nas últimas 24h.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.direction === 'OUTBOUND'
                    ? 'crm-ml-auto crm-max-w-[85%] crm-rounded-2xl crm-rounded-tr-sm crm-bg-accent-500/15 crm-px-3 crm-py-2 crm-text-sm crm-text-white'
                    : 'crm-mr-auto crm-max-w-[85%] crm-rounded-2xl crm-rounded-tl-sm crm-bg-white/[0.06] crm-px-3 crm-py-2 crm-text-sm crm-text-white'
                }
              >
                <p>{message.content}</p>
                <p className="crm-mt-1 crm-text-[10px] crm-text-slate-400">
                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
                    new Date(message.sentAt)
                  )}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
