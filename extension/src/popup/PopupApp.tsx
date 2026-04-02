import { useEffect, useState } from 'react';
import { LockKeyhole, Server, Sparkles } from 'lucide-react';
import type { AuthSession } from '../shared/types';

const LOCAL_PREVIEW_URL = 'local://preview';

async function sendMessage<T = unknown>(message: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Erro inesperado.');
  }
  return response.data as T;
}

export function PopupApp() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const current = await sendMessage<AuthSession>({
        type: 'auth:login',
        payload: {
          email,
          password,
          apiBaseUrl
        }
      });
      setSession(current);
      setPassword('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBaseUrl = async () => {
    const current = await sendMessage<AuthSession>({
      type: 'auth:update-base-url',
      payload: { apiBaseUrl }
    });
    setSession(current);
  };

  const handleLocalMode = async () => {
    setLoading(true);
    setError(null);

    try {
      const current = await sendMessage<AuthSession>({
        type: 'auth:login',
        payload: {
          email: email || 'preview@crmjohn.local',
          password: password || 'preview',
          apiBaseUrl: LOCAL_PREVIEW_URL
        }
      });
      setSession(current);
      setApiBaseUrl(current.apiBaseUrl);
      setPassword('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha ao ativar modo local.');
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
          <h1 className="crm-mt-3 crm-text-xl crm-font-semibold">Extensão comercial premium</h1>
          <p className="crm-mt-1 crm-text-sm crm-leading-6 crm-text-slate-400">
            Conecte a sidebar do WhatsApp Web ao backend e carregue contexto do lead em tempo real.
          </p>
        </div>

        <div className="crm-space-y-4 crm-p-5">
          <div className="crm-rounded-2xl crm-border crm-border-cyan-400/15 crm-bg-cyan-400/10 crm-p-4">
            <p className="crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-cyan-300">
              Modo de teste
            </p>
            <p className="crm-mt-2 crm-text-sm crm-leading-6 crm-text-cyan-100/85">
              Você pode testar a sidebar sem backend, com persistência local de notas, tarefas, pipeline e templates.
            </p>
          </div>

          {session?.token ? (
            <div className="crm-rounded-2xl crm-border crm-border-emerald-400/15 crm-bg-emerald-400/10 crm-p-4">
              <p className="crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-emerald-300">
                Sessão ativa
              </p>
              <p className="crm-mt-2 crm-text-sm crm-font-medium crm-text-white">
                {session.user?.name ?? session.user?.email ?? 'Usuário autenticado'}
              </p>
              <p className="crm-mt-1 crm-text-xs crm-text-emerald-100/75">
                {session.apiBaseUrl === LOCAL_PREVIEW_URL ? 'Modo local persistente' : session.apiBaseUrl}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleLocalMode()}
            disabled={loading}
            className="crm-w-full crm-rounded-2xl crm-border crm-border-cyan-400/20 crm-bg-cyan-400/10 crm-px-4 crm-py-3 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-cyan-200 transition hover:crm-bg-cyan-400/15 disabled:crm-opacity-50"
          >
            {loading ? 'Carregando...' : 'Ativar Modo Local'}
          </button>

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

          <button
            type="button"
            onClick={() => void handleUpdateBaseUrl()}
            className="crm-w-full crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/[0.04] crm-px-4 crm-py-3 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-slate-200 transition hover:crm-border-accent-500/30 hover:crm-text-white"
          >
            Salvar URL
          </button>

          <label className="crm-block">
            <span className="crm-mb-2 crm-flex crm-items-center crm-gap-2 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-slate-400">
              <LockKeyhole className="crm-h-4 crm-w-4" />
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="crm-w-full crm-rounded-2xl crm-border crm-border-white/10 crm-bg-white/[0.04] crm-px-4 crm-py-3 crm-text-sm crm-text-white focus:crm-border-accent-500/30 focus:crm-outline-none"
            />
          </label>

          <label className="crm-block">
            <span className="crm-mb-2 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.18em] crm-text-slate-400">
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            onClick={() => void handleLogin()}
            disabled={loading || !email || !password}
            className="crm-w-full crm-rounded-2xl crm-border crm-border-accent-500/30 crm-bg-accent-500/12 crm-px-4 crm-py-3 crm-text-xs crm-font-semibold crm-uppercase crm-tracking-[0.2em] crm-text-accent-300 transition hover:crm-bg-accent-500/18 disabled:crm-opacity-50"
          >
            {loading ? 'Carregando...' : session?.token ? 'Atualizar Sessão Real' : 'Entrar no Backend'}
          </button>
        </div>
      </div>
    </main>
  );
}
