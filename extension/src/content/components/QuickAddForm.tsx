import { useState } from 'react';
import { cn } from '../../shared/utils';

interface QuickAddFormProps {
  placeholder: string;
  buttonLabel: string;
  onSubmit(value: string): Promise<void>;
  multiline?: boolean;
}

export function QuickAddForm({
  placeholder,
  buttonLabel,
  onSubmit,
  multiline = false
}: QuickAddFormProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(value.trim());
      setValue('');
    } finally {
      setSubmitting(false);
    }
  };

  const commonClassName =
    'crm-w-full crm-rounded-2xl crm-border crm-border-white/10 crm-bg-black/20 crm-px-3 crm-py-3 crm-text-sm crm-text-white placeholder:crm-text-slate-500 focus:crm-border-accent-500/30 focus:crm-outline-none';

  return (
    <div className="crm-space-y-3">
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className={cn(commonClassName, 'crm-resize-none')}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className={commonClassName}
        />
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !value.trim()}
        className="crm-w-full crm-rounded-2xl crm-border crm-border-accent-500/30 crm-bg-accent-500/12 crm-px-4 crm-py-3 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-accent-300 transition hover:crm-bg-accent-500/18 disabled:crm-cursor-not-allowed disabled:crm-opacity-50"
      >
        {submitting ? 'Salvando...' : buttonLabel}
      </button>
    </div>
  );
}
