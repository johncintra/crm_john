import { AlertTriangle, BadgeCheck, Clock3, CreditCard, WalletCards } from 'lucide-react';
import { cn } from '../../shared/utils';

type StatusTone = 'default' | 'warning' | 'success' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  icon?: 'clock' | 'pix' | 'card' | 'success' | 'warning';
}

const toneClasses: Record<StatusTone, string> = {
  default: 'crm-border-slate-700/80 crm-bg-slate-900/80 crm-text-slate-200',
  warning: 'crm-border-amber-400/20 crm-bg-amber-400/10 crm-text-amber-200',
  success: 'crm-border-emerald-400/20 crm-bg-emerald-400/10 crm-text-emerald-200',
  danger: 'crm-border-rose-400/20 crm-bg-rose-400/10 crm-text-rose-200'
};

const icons = {
  clock: Clock3,
  pix: WalletCards,
  card: CreditCard,
  success: BadgeCheck,
  warning: AlertTriangle
};

export function StatusBadge({ label, tone = 'default', icon = 'clock' }: StatusBadgeProps) {
  const Icon = icons[icon];

  return (
    <span
      className={cn(
        'crm-inline-flex crm-items-center crm-gap-2 crm-rounded-full crm-border crm-px-3 crm-py-1.5 crm-text-[11px] crm-font-medium crm-tracking-[0.16em] uppercase',
        toneClasses[tone]
      )}
    >
      <Icon className="crm-h-3.5 crm-w-3.5" />
      {label}
    </span>
  );
}
