import {
  addLeadNote,
  addLeadTag,
  assignContactToStage,
  createLeadTask,
  createPipeline,
  createPipelineStage,
  deletePipeline,
  deletePipelineStage,
  fetchCheckoutBoard,
  fetchLeadContext,
  fetchLeadMessages,
  fetchPipelineBoard,
  fetchPipelines,
  fetchWorkspaceTemplates,
  getProfile,
  login,
  movePipelineCard,
  removeLeadTag,
  removePipelineCard,
  renamePipeline,
  reorderPipelineStages,
  syncLeadMessages,
  updateApiBaseUrl,
  updateLeadEmail,
  updateLeadPhone,
  updateLeadStage,
  updatePipelineStage,
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
        case 'workspace:fetch-templates': {
          const data = await fetchWorkspaceTemplates();
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
        case 'pipeline:fetch-list': {
          const data = await fetchPipelines();
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:create': {
          const data = await createPipeline(message.payload.name);
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:rename': {
          await renamePipeline(message.payload.id, message.payload.name);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:delete': {
          await deletePipeline(message.payload.id);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:fetch-board': {
          const data = await fetchPipelineBoard(message.payload.id);
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:create-stage': {
          const data = await createPipelineStage(message.payload.pipelineId, message.payload.name, message.payload.color);
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:update-stage': {
          await updatePipelineStage(message.payload.pipelineId, message.payload.stageId, message.payload.name, message.payload.color);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:delete-stage': {
          await deletePipelineStage(message.payload.pipelineId, message.payload.stageId);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:reorder-stages': {
          await reorderPipelineStages(message.payload.pipelineId, message.payload.stageId, message.payload.targetStageId);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:assign-contact': {
          const data = await assignContactToStage(
            message.payload.pipelineId,
            message.payload.stageId,
            message.payload.name,
            message.payload.phone,
            {
              email: message.payload.email,
              tagIds: message.payload.tagIds,
              originAmount: message.payload.originAmount,
              originCurrency: message.payload.originCurrency,
              originProductName: message.payload.originProductName,
              originOrderStatus: message.payload.originOrderStatus
            }
          );
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'lead:update-email': {
          await updateLeadEmail(message.payload.leadId, message.payload.email);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'lead:add-tag': {
          const data = await addLeadTag(message.payload.leadId, message.payload.name, message.payload.color);
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'lead:remove-tag': {
          await removeLeadTag(message.payload.leadId, message.payload.tagId);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:move-card': {
          await movePipelineCard(message.payload.pipelineId, message.payload.leadId, message.payload.stageId);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'pipeline:remove-card': {
          await removePipelineCard(message.payload.pipelineId, message.payload.leadId);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'lead:fetch-messages': {
          const data = await fetchLeadMessages(message.payload.leadId, message.payload.hours);
          sendResponse({ ok: true, data } satisfies BackgroundResponse);
          return;
        }
        case 'lead:sync-messages': {
          await syncLeadMessages(message.payload.leadId, message.payload.messages);
          sendResponse({ ok: true } satisfies BackgroundResponse);
          return;
        }
        case 'lead:update-phone': {
          await updateLeadPhone(message.payload.leadId, message.payload.phone);
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
