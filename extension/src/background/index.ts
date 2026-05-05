import {
  addLeadNote,
  createLeadTask,
  fetchCheckoutBoard,
  fetchLeadContext,
  getProfile,
  login,
  updateApiBaseUrl,
  updateLeadStage,
  updateTaskStatus
} from './api';
import { clearStoredSession, getStoredSession } from '../shared/storage';
import type { BackgroundRequest, BackgroundResponse } from '../shared/types';

chrome.runtime.onInstalled.addListener(() => {
  void getStoredSession();
});

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case 'auth:get-session': {
          const session = await getProfile();
          sendResponse({ ok: true, data: session } satisfies BackgroundResponse);
          return;
        }
        case 'auth:login': {
          const session = await login(message.payload);
          sendResponse({ ok: true, data: session } satisfies BackgroundResponse);
          return;
        }
        case 'auth:logout': {
          await clearStoredSession();
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'auth:update-base-url': {
          const session = await updateApiBaseUrl(message.payload.apiBaseUrl);
          sendResponse({ ok: true, data: session } satisfies BackgroundResponse);
          return;
        }
        case 'lead:fetch-context': {
          const data = await fetchLeadContext(message.payload.phone);
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'checkout:fetch-board': {
          const data = await fetchCheckoutBoard();
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'lead:add-note': {
          await addLeadNote(message.payload.leadId, message.payload.content);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'lead:create-task': {
          await createLeadTask(
            message.payload.leadId,
            message.payload.title,
            message.payload.description
          );
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'task:update-status': {
          await updateTaskStatus(message.payload.taskId, message.payload.status);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'lead:update-stage': {
          await updateLeadStage(message.payload.leadId, message.payload.stageId);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        default: {
          sendResponse({ ok: false, error: 'Unsupported message type.' } satisfies BackgroundResponse);
        }
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unexpected background error.';
      sendResponse({ ok: false, error: messageText } satisfies BackgroundResponse);
    }
  })();

  return true;
});
