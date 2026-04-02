import { mapLeadContext } from '../shared/mappers';
import { getStoredSession, setStoredSession } from '../shared/storage';
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
  LeadContext,
  LoginPayload,
  TaskStatus
} from '../shared/types';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  apiBaseUrl?: string;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = await getStoredSession();
  const apiBaseUrl = options.apiBaseUrl ?? session.apiBaseUrl;
  const token = options.token ?? session.token;

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
  if (!session.token) {
    return session;
  }

  if (isPreviewSession(session)) {
    return getPreviewProfile();
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
  if (!session.token || isPreviewSession(session)) {
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

export async function addLeadNote(leadId: string, content: string): Promise<void> {
  const session = await getStoredSession();
  if (!session.token || isPreviewSession(session)) {
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
  if (!session.token || isPreviewSession(session)) {
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
  if (!session.token || isPreviewSession(session)) {
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
  if (!session.token || isPreviewSession(session)) {
    await updatePreviewLeadStage(leadId, stageId);
    return;
  }

  await request(`/leads/${leadId}/stage`, {
    method: 'PATCH',
    body: { stageId }
  });
}
