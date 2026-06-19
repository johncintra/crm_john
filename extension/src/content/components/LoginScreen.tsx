import { useState, type FormEvent } from 'react';
import { LogIn, Sparkles } from 'lucide-react';

interface LoginScreenProps {
  onLogin(email: string, password: string): Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClassName =
    'crm-w-full crm-rounded-2xl crm-border crm-border-white/10 crm-bg-black/20 crm-px-4 crm-py-3 crm-text-sm crm-text-white placeholder:crm-text-slate-500 focus:crm-border-accent-500/30 focus:crm-outline-none';

  return (
    <div className="crm-flex crm-h-full crm-min-h-[420px] crm-flex-col crm-items-center crm-justify-center crm-px-6 crm-py-10">
      <div className="crm-inline-flex crm-items-center crm-gap-2 crm-rounded-full crm-border crm-border-accent-500/20 crm-bg-accent-500/10 crm-px-3 crm-py-1 crm-text-[10px] crm-font-semibold crm-uppercase crm-tracking-[0.26em] crm-text-accent-300">
        <Sparkles className="crm-h-3.5 crm-w-3.5" />
        CRM John
      </div>

      <h1 className="crm-mt-4 crm-text-xl crm-font-semibold crm-text-white">Entrar</h1>
      <p className="crm-mt-1 crm-text-center crm-text-sm crm-leading-6 crm-text-slate-400">
        Acesse com sua conta para ver seus funis e leads de qualquer navegador.
      </p>

      <form onSubmit={handleSubmit} className="crm-mt-6 crm-w-full crm-space-y-3">
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-mail"
          className={inputClassName}
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Senha"
          className={inputClassName}
        />

        {error ? (
          <div className="crm-rounded-2xl crm-border crm-border-rose-400/15 crm-bg-rose-400/10 crm-p-3 crm-text-sm crm-text-rose-100">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !email.trim() || !password.trim()}
          className="crm-flex crm-w-full crm-items-center crm-justify-center crm-gap-2 crm-rounded-2xl crm-border crm-border-accent-500/30 crm-bg-accent-500/12 crm-px-4 crm-py-3 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-accent-300 transition hover:crm-bg-accent-500/18 disabled:crm-cursor-not-allowed disabled:crm-opacity-50"
        >
          <LogIn className="crm-h-4 crm-w-4" />
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
