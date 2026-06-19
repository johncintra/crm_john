import type { AuthSession } from './types';

const STORAGE_KEY = 'crm-john-auth-session';
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function getStoredSession(): Promise<AuthSession> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const session = result[STORAGE_KEY] as Partial<AuthSession> | undefined;

  return {
    token: session?.token ?? null,
    apiBaseUrl: session?.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    user: session?.user ?? null
  };
}

export async function setStoredSession(session: AuthSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function clearStoredSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

const PENDING_HISTORY_KEY = 'crm-john-pending-message-history';

export interface PendingMessageHistory {
  leadId: string;
  name: string;
}

export async function savePendingMessageHistory(value: PendingMessageHistory): Promise<void> {
  await chrome.storage.local.set({ [PENDING_HISTORY_KEY]: value });
}

export async function takePendingMessageHistory(): Promise<PendingMessageHistory | null> {
  const result = await chrome.storage.local.get(PENDING_HISTORY_KEY);
  const value = (result[PENDING_HISTORY_KEY] as PendingMessageHistory | undefined) ?? null;
  if (value) {
    await chrome.storage.local.remove(PENDING_HISTORY_KEY);
  }
  return value;
}
