import { mapLeadContext, mapTemplate } from '../shared/mappers';
import { getStoredSession, setStoredSession } from '../shared/storage';
import type { RemoteLeadMessage, RemotePipeline, RemotePipelineBoard, SyncMessageItem } from '../shared/types';
import {
  activatePreviewSession,
  addPreviewLeadNote,
  createPreviewLeadTask,
  getPreviewLeadContext,
  getPreviewProfile,
  isPreviewSession,
  PREVIEW_API_BASE_URL,
  updatePreviewLeadStage,
  updatePreviewTaskStatus
} from './local-preview';
import type {
  AuthSession,
  CheckoutBoardData,
  LeadContext,
  LoginPayload,
  MessageTemplate,
  TaskStatus
} from '../shared/types';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  apiBaseUrl?: string;
}

export const NOT_AUTHENTICATED = 'NOT_AUTHENTICATED';

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = await getStoredSession();
  const apiBaseUrl = options.apiBaseUrl ?? session.apiBaseUrl;
  const token = options.token ?? session.token;
  const isAuthRoute = path === '/auth/login' || path === '/auth/register';

  if (!token && apiBaseUrl !== PREVIEW_API_BASE_URL && !isAuthRoute) {
    throw new Error(NOT_AUTHENTICATED);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload && typeof payload.message === 'string' && payload.message) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const session = await getStoredSession();
  const apiBaseUrl = payload.apiBaseUrl?.trim() || session.apiBaseUrl;

  if (apiBaseUrl === PREVIEW_API_BASE_URL) {
    return activatePreviewSession(payload);
  }

  const result = await request<{ accessToken: string; user?: AuthSession['user'] }>(
    '/auth/login',
    {
      method: 'POST',
      apiBaseUrl,
      body: {
        email: payload.email,
        password: payload.password
      }
    }
  );

  const nextSession: AuthSession = {
    apiBaseUrl,
    token: result.accessToken,
    user: result.user ?? null
  };

  await setStoredSession(nextSession);
  return nextSession;
}

export async function getProfile(): Promise<AuthSession> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    return getPreviewProfile();
  }

  if (!session.token) {
    return session;
  }

  try {
    const profile = await request<{
      id: string;
      name: string;
      email: string;
    }>('/auth/me');
    const nextSession = {
      ...session,
      user: profile
        ? {
            id: profile.id,
            name: profile.name,
            email: profile.email
          }
        : null
    };
    await setStoredSession(nextSession);
    return nextSession;
  } catch {
    return session;
  }
}

export async function updateApiBaseUrl(apiBaseUrl: string): Promise<AuthSession> {
  const current = await getStoredSession();
  const nextSession = { ...current, apiBaseUrl };
  await setStoredSession(nextSession);
  return nextSession;
}

export async function fetchLeadContext(phone: string): Promise<LeadContext | null> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    return getPreviewLeadContext(phone);
  }

  const leadByPhone = await request<unknown>(`/leads/by-phone/${encodeURIComponent(phone)}`);
  const leadRecord = (leadByPhone && typeof leadByPhone === 'object' ? leadByPhone : {}) as {
    id?: string;
  };

  if (!leadRecord.id) {
    return null;
  }

  const [lead, timeline, notes, tasks, pipeline, templates] = await Promise.all([
    request<unknown>(`/leads/${leadRecord.id}`),
    request<unknown>(`/leads/${leadRecord.id}/timeline`),
    request<unknown>(`/leads/${leadRecord.id}/notes`),
    request<unknown>(`/leads/${leadRecord.id}/tasks`),
    request<unknown>('/pipelines/default'),
    request<unknown>('/templates')
  ]);

  return mapLeadContext({
    lead,
    timeline,
    notes,
    tasks,
    pipeline,
    templates
  });
}

export async function fetchCheckoutBoard(): Promise<CheckoutBoardData> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    return {
      funnel: {
        id: 'checkout-preview',
        name: 'Checkout'
      },
      columns: [
        { id: 'preview-boleto', name: 'Boleto Gerado', color: '#a78bfa', position: 1 },
        { id: 'preview-pix', name: 'Pix Gerado', color: '#06b6d4', position: 2 },
        { id: 'preview-abandoned', name: 'Carrinho Abandonado', color: '#94a3b8', position: 3 },
        { id: 'preview-declined', name: 'Compra Recusada', color: '#ef4444', position: 4 },
        { id: 'preview-refunded', name: 'Reembolso', color: '#f59e0b', position: 5 },
        { id: 'preview-chargeback', name: 'Chargeback', color: '#7c3aed', position: 6 },
        { id: 'preview-awaiting', name: 'Aguardando Compra', color: '#facc15', position: 7 },
        { id: 'preview-approved', name: 'Compra Aprovada', color: '#22c55e', position: 8 }
      ],
      cards: []
    };
  }

  return request<CheckoutBoardData>('/pipelines/checkout/board');
}

export async function fetchWorkspaceTemplates(): Promise<MessageTemplate[]> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    return [
      { id: 'pv-1', title: 'Pix Pendente', category: 'PIX_PENDING', content: 'Oi! Vi que seu pagamento via Pix foi gerado. Se quiser, posso te ajudar a finalizar agora.' },
      { id: 'pv-2', title: 'Cartão Recusado', category: 'CREDIT_CARD_DECLINED', content: 'Oi! Seu pagamento no cartão não foi aprovado. Se quiser, posso te ajudar com outro cartão ou Pix.' },
      { id: 'pv-3', title: 'Compra Aprovada', category: 'PURCHASE_APPROVED', content: 'Parabéns pela compra. Se precisar de ajuda com o acesso, me chama aqui.' }
    ];
  }

  const raw = await request<unknown[]>('/templates');
  return raw.map(mapTemplate);
}

export async function addLeadNote(leadId: string, content: string): Promise<void> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    await addPreviewLeadNote(leadId, content);
    return;
  }

  await request(`/leads/${leadId}/notes`, {
    method: 'POST',
    body: { content }
  });
}

export async function createLeadTask(
  leadId: string,
  title: string,
  description?: string
): Promise<void> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    await createPreviewLeadTask(leadId, title, description);
    return;
  }

  await request(`/leads/${leadId}/tasks`, {
    method: 'POST',
    body: { title, description }
  });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    await updatePreviewTaskStatus(taskId, status);
    return;
  }

  await request(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: { status }
  });
}

export async function updateLeadStage(leadId: string, stageId: string): Promise<void> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) {
    await updatePreviewLeadStage(leadId, stageId);
    return;
  }

  await request(`/leads/${leadId}/stage`, {
    method: 'PATCH',
    body: { stageId }
  });
}

export async function fetchPipelines(): Promise<RemotePipeline[]> {
  const session = await getStoredSession();
  if (isPreviewSession(session)) return [];
  return request<RemotePipeline[]>('/pipelines');
}

export async function createPipeline(name: string): Promise<RemotePipeline> {
  return request<RemotePipeline>('/pipelines', { method: 'POST', body: { name } });
}

export async function renamePipeline(id: string, name: string): Promise<void> {
  await request(`/pipelines/${id}`, { method: 'PATCH', body: { name } });
}

export async function deletePipeline(id: string): Promise<void> {
  await request(`/pipelines/${id}`, { method: 'DELETE' });
}

export async function fetchPipelineBoard(id: string): Promise<RemotePipelineBoard> {
  return request<RemotePipelineBoard>(`/pipelines/${id}/board`);
}

export async function createPipelineStage(pipelineId: string, name: string, color: string): Promise<{ id: string; name: string; color: string; position: number }> {
  return request(`/pipelines/${pipelineId}/stages`, { method: 'POST', body: { name, color } });
}

export async function updatePipelineStage(pipelineId: string, stageId: string, name: string, color: string): Promise<void> {
  await request(`/pipelines/${pipelineId}/stages/${stageId}`, { method: 'PATCH', body: { name, color } });
}

export async function deletePipelineStage(pipelineId: string, stageId: string): Promise<void> {
  await request(`/pipelines/${pipelineId}/stages/${stageId}`, { method: 'DELETE' });
}

export async function reorderPipelineStages(pipelineId: string, stageId: string, targetStageId: string): Promise<void> {
  await request(`/pipelines/${pipelineId}/stages/reorder`, { method: 'POST', body: { stageId, targetStageId } });
}

export async function assignContactToStage(pipelineId: string, stageId: string, name: string, phone?: string | null): Promise<RemotePipelineBoard['cards'][number]> {
  return request(`/pipelines/${pipelineId}/cards`, { method: 'POST', body: { stageId, name, phone } });
}

export async function movePipelineCard(pipelineId: string, leadId: string, stageId: string): Promise<void> {
  await request(`/pipelines/${pipelineId}/cards/${leadId}/move`, { method: 'PATCH', body: { stageId } });
}

export async function removePipelineCard(pipelineId: string, leadId: string): Promise<void> {
  await request(`/pipelines/${pipelineId}/cards/${leadId}`, { method: 'DELETE' });
}

export async function fetchLeadMessages(leadId: string, hours = 24): Promise<RemoteLeadMessage[]> {
  return request(`/leads/${leadId}/messages?hours=${hours}`);
}

export async function syncLeadMessages(leadId: string, messages: SyncMessageItem[]): Promise<void> {
  if (!messages.length) return;
  await request(`/leads/${leadId}/messages/sync`, { method: 'POST', body: { messages } });
}

export async function updateLeadPhone(leadId: string, phone: string): Promise<void> {
  await request(`/leads/${leadId}/phone`, { method: 'PATCH', body: { phone } });
}
