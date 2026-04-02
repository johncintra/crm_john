import type {
  LeadContext,
  LeadNote,
  LeadSummary,
  LeadTask,
  LeadTag,
  MessageTemplate,
  OrderStatus,
  PipelineData,
  PipelineStage,
  TimelineItem
} from './types';

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function mapLeadSummary(value: unknown): LeadSummary {
  const item = asObject(value);
  const latestOrder = asObject(item.latestOrder);
  const currentStage = asObject(item.currentStage);

  return {
    id: asString(item.id),
    name: asString(item.name, 'Lead sem nome'),
    email: asNullableString(item.email),
    phone: asNullableString(item.phone),
    normalizedPhone: asNullableString(item.normalizedPhone),
    source: asNullableString(item.source),
    temperature: asNullableString(item.temperature),
    cpf: asNullableString(item.cpf),
    currentStage: currentStage.id
      ? {
          id: asString(currentStage.id),
          name: asString(currentStage.name),
          color: asNullableString(currentStage.color)
        }
      : null,
    latestOrder: latestOrder.id
      ? {
          id: asString(latestOrder.id),
          productName: asString(latestOrder.productName, 'Produto'),
          amount: asNumber(latestOrder.amount),
          currency: asString(latestOrder.currency, 'BRL'),
          status: asString(latestOrder.status, 'OPEN') as OrderStatus
        }
      : null,
    tags: asArray(item.tags).map(mapLeadTag)
  };
}

export function mapLeadTag(value: unknown): LeadTag {
  const item = asObject(value);

  return {
    id: asString(item.id),
    name: asString(item.name, 'Tag'),
    color: asNullableString(item.color)
  };
}

export function mapTimelineItem(value: unknown): TimelineItem {
  const item = asObject(value);

  return {
    id: asString(item.id),
    type: (asString(item.type, 'system') as TimelineItem['type']),
    title: asString(item.title, 'Atualização'),
    description: asNullableString(item.description),
    timestamp: asString(item.timestamp, new Date().toISOString()),
    metadata: asObject(item.metadata)
  };
}

export function mapLeadNote(value: unknown): LeadNote {
  const item = asObject(value);

  return {
    id: asString(item.id),
    content: asString(item.content),
    createdAt: asString(item.createdAt, new Date().toISOString()),
    authorName: asNullableString(item.authorName ?? item.author?.name)
  };
}

export function mapLeadTask(value: unknown): LeadTask {
  const item = asObject(value);

  return {
    id: asString(item.id),
    title: asString(item.title),
    description: asNullableString(item.description),
    dueAt: asNullableString(item.dueAt),
    status: asString(item.status, 'OPEN') as LeadTask['status'],
    assignedUserName: asNullableString(item.assignedUserName ?? item.assignedUser?.name)
  };
}

export function mapTemplate(value: unknown): MessageTemplate {
  const item = asObject(value);

  return {
    id: asString(item.id),
    title: asString(item.title),
    category: asString(item.category, 'GENERAL') as MessageTemplate['category'],
    content: asString(item.content)
  };
}

export function mapPipelineStage(value: unknown): PipelineStage {
  const item = asObject(value);

  return {
    id: asString(item.id),
    name: asString(item.name),
    color: asNullableString(item.color),
    position: asNumber(item.position)
  };
}

export function mapPipeline(value: unknown): PipelineData | null {
  const item = asObject(value);
  if (!item.id) {
    return null;
  }

  return {
    id: asString(item.id),
    name: asString(item.name, 'Pipeline'),
    stages: asArray(item.stages).map(mapPipelineStage).sort((a, b) => a.position - b.position)
  };
}

export function mapLeadContext(value: unknown): LeadContext | null {
  const item = asObject(value);
  if (!item.lead) {
    return null;
  }

  return {
    lead: mapLeadSummary(item.lead),
    timeline: asArray(item.timeline).map(mapTimelineItem),
    notes: asArray(item.notes).map(mapLeadNote),
    tasks: asArray(item.tasks).map(mapLeadTask),
    templates: asArray(item.templates).map(mapTemplate),
    pipeline: mapPipeline(item.pipeline)
  };
}
