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
// chrome.storage.local is shared across every tab/window of the browser —
// there's only ever one pending entry. If the reload it's waiting for never
// happens the way expected (WhatsApp's router intercepts the navigation,
// the user navigates away first, etc.), it's left dangling and would
// otherwise get consumed by a later, unrelated reload — popping up a
// completely different lead's history. Anything older than this gets
// silently dropped instead of shown.
const PENDING_HISTORY_MAX_AGE_MS = 30_000;

export interface PendingMessageHistory {
  leadId: string;
  name: string;
}

interface StoredPendingMessageHistory extends PendingMessageHistory {
  savedAt: number;
}

export async function savePendingMessageHistory(value: PendingMessageHistory): Promise<void> {
  const stored: StoredPendingMessageHistory = { ...value, savedAt: Date.now() };
  await chrome.storage.local.set({ [PENDING_HISTORY_KEY]: stored });
}

export async function takePendingMessageHistory(): Promise<PendingMessageHistory | null> {
  const result = await chrome.storage.local.get(PENDING_HISTORY_KEY);
  const value = (result[PENDING_HISTORY_KEY] as StoredPendingMessageHistory | undefined) ?? null;
  if (value) {
    await chrome.storage.local.remove(PENDING_HISTORY_KEY);
  }
  if (!value || Date.now() - value.savedAt > PENDING_HISTORY_MAX_AGE_MS) {
    return null;
  }
  return { leadId: value.leadId, name: value.name };
}
