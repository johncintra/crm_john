import type { PipelineData } from '../../shared/types';
import { cn } from '../../shared/utils';

interface PipelineCardProps {
  pipeline: PipelineData | null | undefined;
  currentStageId?: string | null;
  onMove(stageId: string): void | Promise<void>;
}

export function PipelineCard({ pipeline, currentStageId, onMove }: PipelineCardProps) {
  if (!pipeline) {
    return null;
  }

  return (
    <div className="crm-space-y-3">
      {pipeline.stages.map((stage) => {
        const active = stage.id === currentStageId;

        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onMove(stage.id)}
            className={cn(
              'crm-flex crm-w-full crm-items-center crm-justify-between crm-rounded-2xl crm-border crm-px-3 crm-py-3 crm-text-left transition',
              active
                ? 'crm-border-accent-500/25 crm-bg-accent-500/12'
                : 'crm-border-white/8 crm-bg-white/[0.04] hover:crm-border-white/15 hover:crm-bg-white/[0.06]'
            )}
          >
            <div className="crm-flex crm-items-center crm-gap-3">
              <span
                className="crm-h-2.5 crm-w-2.5 crm-rounded-full"
                style={{ backgroundColor: stage.color ?? 'oklch(0.526 0.247 293)' }}
              />
              <span className="crm-text-sm crm-font-medium crm-text-white">{stage.name}</span>
            </div>
            {active ? (
              <span className="crm-text-[10px] crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-accent-300">
                Atual
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
