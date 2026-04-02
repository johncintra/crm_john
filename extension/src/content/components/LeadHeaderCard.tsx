import type { ReactNode } from 'react';
import { CircleDollarSign, Mail, Phone, Sparkles } from 'lucide-react';
import type { LeadSummary } from '../../shared/types';
import { formatCurrency } from '../../shared/utils';
import { StatusBadge } from './StatusBadge';

interface LeadHeaderCardProps {
  lead: LeadSummary;
}

export function LeadHeaderCard({ lead }: LeadHeaderCardProps) {
  return (
    <section className="crm-relative crm-overflow-hidden crm-rounded-[28px] crm-border crm-border-white/10 crm-bg-aurora crm-p-5 crm-shadow-glow crm-shadow-black/50">
      <div className="crm-absolute crm-right-0 crm-top-0 crm-h-28 crm-w-28 crm-rounded-full crm-bg-accent-500/10 crm-blur-3xl" />
      <div className="crm-relative">
        <div className="crm-flex crm-items-start crm-justify-between crm-gap-3">
          <div>
            <div className="crm-inline-flex crm-items-center crm-gap-2 crm-rounded-full crm-border crm-border-white/10 crm-bg-white/5 crm-px-3 crm-py-1 crm-text-[10px] crm-font-semibold crm-uppercase crm-tracking-[0.26em] crm-text-accent-300">
              <Sparkles className="crm-h-3.5 crm-w-3.5" />
              Contexto Comercial
            </div>
            <h1 className="crm-mt-3 crm-text-[24px] crm-font-semibold crm-leading-tight crm-text-white">
              {lead.name}
            </h1>
            <p className="crm-mt-1 crm-text-sm crm-text-slate-300">
              {lead.source ?? 'Origem não informada'}
            </p>
          </div>
          <StatusBadge
            label={lead.currentStage?.name ?? 'Sem etapa'}
            tone="default"
            icon="clock"
          />
        </div>

        <div className="crm-mt-5 crm-grid crm-grid-cols-2 crm-gap-3">
          <InfoPill icon={<Phone className="crm-h-4 crm-w-4" />} label="Telefone" value={lead.phone ?? '--'} />
          <InfoPill icon={<Mail className="crm-h-4 crm-w-4" />} label="Email" value={lead.email ?? '--'} />
          <InfoPill
            icon={<Sparkles className="crm-h-4 crm-w-4" />}
            label="Produto"
            value={lead.latestOrder?.productName ?? 'Sem compra'}
          />
          <InfoPill
            icon={<CircleDollarSign className="crm-h-4 crm-w-4" />}
            label="Último valor"
            value={formatCurrency(lead.latestOrder?.amount, lead.latestOrder?.currency ?? 'BRL')}
          />
        </div>
      </div>
    </section>
  );
}

function InfoPill({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="crm-rounded-2xl crm-border crm-border-white/10 crm-bg-black/20 crm-p-3 backdrop-blur-sm">
      <div className="crm-flex crm-items-center crm-gap-2 crm-text-[11px] crm-uppercase crm-tracking-[0.18em] crm-text-slate-400">
        <span className="crm-text-accent-300">{icon}</span>
        {label}
      </div>
      <p className="crm-mt-2 crm-line-clamp-2 crm-text-sm crm-font-medium crm-text-white">{value}</p>
    </div>
  );
}
