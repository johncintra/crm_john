import {
  BadgeCheck,
  CircleDot,
  ClipboardList,
  NotebookPen,
  TrendingUp
} from 'lucide-react';
import type { TimelineItem } from '../../shared/types';
import { formatDate } from '../../shared/utils';

const itemMap = {
  checkout_event: {
    icon: TrendingUp,
    tint: 'crm-text-cyan-200 crm-bg-cyan-400/10 crm-border-cyan-400/15'
  },
  pipeline: {
    icon: CircleDot,
    tint: 'crm-text-violet-200 crm-bg-violet-400/10 crm-border-violet-400/15'
  },
  note: {
    icon: NotebookPen,
    tint: 'crm-text-amber-200 crm-bg-amber-400/10 crm-border-amber-400/15'
  },
  task: {
    icon: ClipboardList,
    tint: 'crm-text-fuchsia-200 crm-bg-fuchsia-400/10 crm-border-fuchsia-400/15'
  },
  system: {
    icon: BadgeCheck,
    tint: 'crm-text-emerald-200 crm-bg-emerald-400/10 crm-border-emerald-400/15'
  }
};

export function EventTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="crm-relative crm-space-y-3">
      <div className="crm-absolute crm-bottom-0 crm-left-[19px] crm-top-0 crm-w-px crm-bg-gradient-to-b crm-from-white/10 crm-via-white/5 crm-to-transparent" />
      {items.map((item) => {
        const config = itemMap[item.type] ?? itemMap.system;
        const Icon = config.icon;

        return (
          <article key={item.id} className="crm-relative crm-pl-12">
            <div
              className={`crm-absolute crm-left-0 crm-top-0 crm-flex crm-h-10 crm-w-10 crm-items-center crm-justify-center crm-rounded-2xl crm-border ${config.tint}`}
            >
              <Icon className="crm-h-4 crm-w-4" />
            </div>
            <div className="crm-rounded-2xl crm-border crm-border-white/8 crm-bg-white/[0.04] crm-p-3">
              <div className="crm-flex crm-items-start crm-justify-between crm-gap-3">
                <h3 className="crm-text-sm crm-font-medium crm-text-white">{item.title}</h3>
                <span className="crm-shrink-0 crm-text-[11px] crm-text-slate-400">
                  {formatDate(item.timestamp)}
                </span>
              </div>
              {item.description ? (
                <p className="crm-mt-1.5 crm-text-xs crm-leading-5 crm-text-slate-400">{item.description}</p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
