import { demoLeadContext } from '../content/demo-data';
import { getStoredSession, setStoredSession } from '../shared/storage';
import type {
  AuthSession,
  LeadContext,
  LeadTask,
  LoginPayload,
  PipelineStage,
  TaskStatus,
  TimelineItem
} from '../shared/types';

const PREVIEW_STORAGE_KEY = 'crm-john-preview-contexts';
export const PREVIEW_API_BASE_URL = 'local://preview';
const PREVIEW_TOKEN = 'preview-token';

type PreviewMap = Record<string, LeadContext>;

function cloneDemoContext(phone: string): LeadContext {
  return {
    ...demoLeadContext,
    lead: {
      ...demoLeadContext.lead,
      id: `lead-${phone}`,
      phone,
      normalizedPhone: phone,
      currentStage: demoLeadContext.lead.currentStage
        ? { ...demoLeadContext.lead.currentStage }
        : null,
      latestOrder: demoLeadContext.lead.latestOrder
        ? { ...demoLeadContext.lead.latestOrder, id: `order-${phone}` }
        : null,
      tags: demoLeadContext.lead.tags?.map((tag) => ({ ...tag })) ?? []
    },
    pipeline: demoLeadContext.pipeline
      ? {
          ...demoLeadContext.pipeline,
          stages: demoLeadContext.pipeline.stages.map((stage) => ({ ...stage }))
        }
      : null,
    timeline: demoLeadContext.timeline.map((item) => ({ ...item })),
    notes: demoLeadContext.notes.map((note) => ({ ...note })),
    tasks: demoLeadContext.tasks.map((task) => ({ ...task })),
    templates: demoLeadContext.templates.map((template) => ({ ...template }))
  };
}

function timestampedId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTimelineItem(
  type: TimelineItem['type'],
  title: string,
  description?: string
): TimelineItem {
  return {
    id: timestampedId(`tl-${type}`),
    type,
    title,
    description,
    timestamp: new Date().toISOString()
  };
}

async function getPreviewMap(): Promise<PreviewMap> {
  const result = await chrome.storage.local.get(PREVIEW_STORAGE_KEY);
  return (result[PREVIEW_STORAGE_KEY] as PreviewMap | undefined) ?? {};
}

async function setPreviewMap(data: PreviewMap): Promise<void> {
  await chrome.storage.local.set({ [PREVIEW_STORAGE_KEY]: data });
}

async function updatePreviewContext(
  phone: string,
  updater: (context: LeadContext) => LeadContext
): Promise<LeadContext> {
  const current = await getPreviewLeadContext(phone);
  const next = updater(current);
  const map = await getPreviewMap();
  map[phone] = next;
  await setPreviewMap(map);
  return next;
}

function findContextByLeadId(map: PreviewMap, leadId: string): { phone: string; context: LeadContext } | null {
  for (const [phone, context] of Object.entries(map)) {
    if (context.lead.id === leadId) {
      return { phone, context };
    }
  }

  return null;
}

function updateTaskStatusInContext(context: LeadContext, taskId: string, status: TaskStatus): LeadContext {
  const task = context.tasks.find((item) => item.id === taskId);
  if (!task) {
    return context;
  }

  const nextTasks = context.tasks.map((item) =>
    item.id === taskId ? { ...item, status } : item
  );

  const nextTimeline = [
    createTimelineItem(
      'task',
      status === 'DONE' ? 'Tarefa concluída' : 'Tarefa atualizada',
      `${task.title} agora está como ${status}.`
    ),
    ...context.timeline
  ];

  return {
    ...context,
    tasks: nextTasks,
    timeline: nextTimeline
  };
}

export function isPreviewSession(session: AuthSession): boolean {
  return session.apiBaseUrl === PREVIEW_API_BASE_URL || session.token === PREVIEW_TOKEN;
}

export async function activatePreviewSession(payload?: Partial<LoginPayload>): Promise<AuthSession> {
  const nextSession: AuthSession = {
    token: PREVIEW_TOKEN,
    apiBaseUrl: PREVIEW_API_BASE_URL,
    user: {
      id: 'preview-user',
      name: 'Modo Local',
      email: payload?.email?.trim() || 'preview@crmjohn.local'
    }
  };

  await setStoredSession(nextSession);
  return nextSession;
}

export async function getPreviewLeadContext(phone: string): Promise<LeadContext> {
  const map = await getPreviewMap();
  const existing = map[phone];
  if (existing) {
    return existing;
  }

  const created = cloneDemoContext(phone);
  map[phone] = created;
  await setPreviewMap(map);
  return created;
}

export async function addPreviewLeadNote(leadId: string, content: string): Promise<void> {
  const map = await getPreviewMap();
  const found = findContextByLeadId(map, leadId);
  if (!found) {
    return;
  }

  map[found.phone] = {
    ...found.context,
    notes: [
      {
        id: timestampedId('note'),
        content,
        createdAt: new Date().toISOString(),
        authorName: 'Modo Local'
      },
      ...found.context.notes
    ],
    timeline: [
      createTimelineItem('note', 'Nota adicionada', content),
      ...found.context.timeline
    ]
  };

  await setPreviewMap(map);
}

export async function createPreviewLeadTask(
  leadId: string,
  title: string,
  description?: string
): Promise<void> {
  const map = await getPreviewMap();
  const found = findContextByLeadId(map, leadId);
  if (!found) {
    return;
  }

  const task: LeadTask = {
    id: timestampedId('task'),
    title,
    description,
    status: 'OPEN',
    assignedUserName: 'Modo Local'
  };

  map[found.phone] = {
    ...found.context,
    tasks: [task, ...found.context.tasks],
    timeline: [
      createTimelineItem('task', 'Tarefa criada', title),
      ...found.context.timeline
    ]
  };

  await setPreviewMap(map);
}

export async function updatePreviewTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const map = await getPreviewMap();
  for (const [phone, context] of Object.entries(map)) {
    if (context.tasks.some((task) => task.id === taskId)) {
      map[phone] = updateTaskStatusInContext(context, taskId, status);
      await setPreviewMap(map);
      return;
    }
  }
}

export async function updatePreviewLeadStage(leadId: string, stageId: string): Promise<void> {
  const map = await getPreviewMap();
  const found = findContextByLeadId(map, leadId);
  if (!found) {
    return;
  }

  const nextStage: PipelineStage | undefined = found.context.pipeline?.stages.find(
    (stage) => stage.id === stageId
  );

  if (!nextStage) {
    return;
  }

  map[found.phone] = {
    ...found.context,
    lead: {
      ...found.context.lead,
      currentStage: {
        id: nextStage.id,
        name: nextStage.name,
        color: nextStage.color
      }
    },
    timeline: [
      createTimelineItem('pipeline', `Lead movido para ${nextStage.name}`),
      ...found.context.timeline
    ]
  };

  await setPreviewMap(map);
}

export async function getPreviewProfile(): Promise<AuthSession> {
  const session = await getStoredSession();
  return isPreviewSession(session)
    ? {
        ...session,
        user: session.user ?? {
          id: 'preview-user',
          name: 'Modo Local',
          email: 'preview@crmjohn.local'
        }
      }
    : session;
}
