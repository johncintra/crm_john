import type { ReactNode } from 'react';
import { cn } from '../../shared/utils';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className
}: SectionCardProps) {
  return (
    <section
      className={cn(
        'crm-relative crm-overflow-hidden crm-rounded-[24px] crm-border crm-border-white/10 crm-bg-white/5 crm-p-4 crm-shadow-soft crm-shadow-black/40 backdrop-blur-xl',
        className
      )}
    >
      <div className="crm-mb-4 crm-flex crm-items-start crm-justify-between crm-gap-3">
        <div>
          <h2 className="crm-text-[13px] crm-font-semibold crm-uppercase crm-tracking-[0.24em] crm-text-slate-300">
            {title}
          </h2>
          {subtitle ? (
            <p className="crm-mt-1 crm-text-xs crm-leading-5 crm-text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="crm-shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
