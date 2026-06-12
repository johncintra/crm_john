import { useEffect, useState } from 'react';
import { Server, Sparkles } from 'lucide-react';
import type { AuthSession } from '../shared/types';

async function sendMessage<T = unknown>(message: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Erro inesperado.');
  }
  return response.data as T;
}

export function PopupApp() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:3000');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const current = await sendMessage<AuthSession>({ type: 'auth:get-session' });
        setSession(current);
        setApiBaseUrl(current.apiBaseUrl);
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : 'Falha ao carregar sessão.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleUpdateBaseUrl = async () => {
    setLoading(true);
    setError(null);

    try {
      await sendMessage<AuthSession>({
        type: 'auth:update-base-url',
        payload: { apiBaseUrl }
      });
      const current = await sendMessage<AuthSession>({ type: 'auth:get-session' });
      setSession(current);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Falha ao atualizar URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const current = await sendMessage<AuthSession>({ type: 'auth:get-session' });
      setSession(current);
      setApiBaseUrl(current.apiBaseUrl);
    } catch (reconnectError) {
      setError(reconnectError instanceof Error ? reconnectError.message : 'Falha ao conectar no backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="crm-min-h-screen crm-bg-aurora crm-p-4 crm-text-white">
      <div className="crm-w-[360px] crm-overflow-hidden crm-rounded-[28px] crm-border crm-border-white/10 crm-bg-slate-950/90 crm-shadow-glow crm-shadow-black/60">
        <div className="crm-border-b crm-border-white/8 crm-p-5">
          <div className="crm-inline-flex crm-items-center crm-gap-2 crm-rounded-full crm-border crm-border-accent-500/20 crm-bg-accent-500/10 crm-px-3 crm-py-1 crm-text-[10px] crm-font-semibold crm-uppercase crm-tracking-[0.26em] crm-text-accent-300">
            <Sparkles className="crm-h-3.5 crm-w-3.5" />
            CRM John
          </div>
          <h1 className="crm-mt-3 crm-text-xl crm-font-semibold">Modo Interno</h1>
          <p className="crm-mt-1 crm-text-sm crm-leading-6 crm-text-slate-400">
            A extensão conecta automaticamente ao workspace interno do backend, sem exigir login manual.
          </p>
        </div>

        <div className="crm-space-y-4 crm-p-5">
          <div className="crm-rounded-2xl crm-border crm-border-emerald-400/15 crm-bg-emerald-400/10 crm-p-4">
            <p className="crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-emerald-300">
              Sessão interna
            </p>
            <p className="crm-mt-2 crm-text-sm crm-font-medium crm-text-white">
              {session?.user?.name ?? 'Operação Interna'}
            </p>
            <p className="crm-mt-1 crm-text-xs crm-text-emerald-100/75">
              {session?.user?.email ?? 'interno@crmjohn.local'}
            </p>
          </div>

          <label className="crm-block">
            <span className="crm-mb-2 crm-flex crm-items-center crm-gap-2 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-slate-400">
              <Server className="crm-h-4 crm-w-4" />
              Backend URL
            </span>
            <input
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              className="crm-w-full crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/[0.04] crm-px-4 crm-py-3 crm-text-sm crm-text-white focus:crm-border-accent-500/30 focus:crm-outline-none"
            />
          </label>

          {error ? (
            <div className="crm-rounded-2xl crm-border crm-border-rose-400/15 crm-bg-rose-400/10 crm-p-3 crm-text-sm crm-text-rose-100">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleUpdateBaseUrl()}
            disabled={loading}
            className="crm-w-full crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/[0.04] crm-px-4 crm-py-3 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-slate-200 transition hover:crm-border-accent-500/30 hover:crm-text-white disabled:crm-opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar URL do Backend'}
          </button>

          <button
            type="button"
            onClick={() => void handleReconnect()}
            disabled={loading}
            className="crm-w-full crm-rounded-2xl crm-border crm-border-accent-500/30 crm-bg-accent-500/12 crm-px-4 crm-py-3 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-accent-300 transition hover:crm-bg-accent-500/18 disabled:crm-opacity-50"
          >
            {loading ? 'Conectando...' : 'Reconectar ao Backend Interno'}
          </button>
        </div>
      </div>
    </main>
  );
}
