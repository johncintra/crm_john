import type { ReactNode } from 'react';
import { SearchSlash } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="crm-flex crm-flex-col crm-items-center crm-justify-center crm-rounded-[24px] crm-border crm-border-dashed crm-border-white/10 crm-bg-white/5 crm-p-8 crm-text-center">
      <div className="crm-mb-4 crm-flex crm-h-14 crm-w-14 crm-items-center crm-justify-center crm-rounded-2xl crm-border crm-border-cyan-400/15 crm-bg-cyan-400/10 crm-text-cyan-200">
        <SearchSlash className="crm-h-6 crm-w-6" />
      </div>
      <h3 className="crm-text-sm crm-font-semibold crm-text-white">{title}</h3>
      <p className="crm-mt-2 crm-max-w-[240px] crm-text-xs crm-leading-5 crm-text-slate-400">
        {description}
      </p>
      {action ? <div className="crm-mt-5">{action}</div> : null}
    </div>
  );
}
