import { CheckCheck, Clock3 } from 'lucide-react';
import type { LeadTask, TaskStatus } from '../../shared/types';
import { cn, formatDate } from '../../shared/utils';

interface TaskListProps {
  tasks: LeadTask[];
  onToggle(taskId: string, status: TaskStatus): void;
}

export function TaskList({ tasks, onToggle }: TaskListProps) {
  return (
    <div className="crm-space-y-3">
      {tasks.map((task) => {
        const isDone = task.status === 'DONE';

        return (
          <article
            key={task.id}
            className={cn(
              'crm-flex crm-items-start crm-justify-between crm-gap-3 crm-rounded-2xl crm-border crm-p-3',
              isDone
                ? 'crm-border-emerald-400/15 crm-bg-emerald-400/10'
                : 'crm-border-white/8 crm-bg-white/[0.04]'
            )}
          >
            <div className="crm-min-w-0">
              <div className="crm-flex crm-items-center crm-gap-2">
                <span
                  className={cn(
                    'crm-inline-flex crm-h-8 crm-w-8 crm-items-center crm-justify-center crm-rounded-xl crm-border',
                    isDone
                      ? 'crm-border-emerald-300/20 crm-bg-emerald-300/10 crm-text-emerald-200'
                      : 'crm-border-white/10 crm-bg-black/20 crm-text-slate-300'
                  )}
                >
                  {isDone ? <CheckCheck className="crm-h-4 crm-w-4" /> : <Clock3 className="crm-h-4 crm-w-4" />}
                </span>
                <div className="crm-min-w-0">
                  <h3 className="crm-text-sm crm-font-medium crm-text-white">{task.title}</h3>
                  {task.description ? (
                    <p className="crm-mt-1 crm-text-xs crm-leading-5 crm-text-slate-400">{task.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="crm-mt-2 crm-flex crm-flex-wrap crm-gap-2 crm-text-[11px] crm-text-slate-500">
                <span>{task.assignedUserName ?? 'Sem responsável'}</span>
                {task.dueAt ? <span>Prazo {formatDate(task.dueAt)}</span> : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToggle(task.id, isDone ? 'OPEN' : 'DONE')}
              className="crm-rounded-xl crm-border crm-border-white/10 crm-bg-black/20 crm-px-3 crm-py-2 crm-text-[11px] crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-slate-200 transition hover:crm-border-accent-500/30 hover:crm-text-white"
            >
              {isDone ? 'Reabrir' : 'Concluir'}
            </button>
          </article>
        );
      })}
    </div>
  );
}
