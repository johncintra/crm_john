export type Provider = 'KIWIFY' | 'HOTMART';

export type OrderStatus =
  | 'OPEN'
  | 'ABANDONED'
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'REFUNDED'
  | 'CHARGEBACK';

export type TemplateCategory =
  | 'PIX_PENDING'
  | 'CREDIT_CARD_DECLINED'
  | 'PURCHASE_APPROVED'
  | 'GENERAL';

export type TimelineItemType =
  | 'checkout_event'
  | 'pipeline'
  | 'note'
  | 'task'
  | 'system';

export type TaskStatus = 'OPEN' | 'DONE' | 'CANCELED';

export interface AuthSession {
  token: string | null;
  apiBaseUrl: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface LeadSummary {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  source?: string | null;
  temperature?: string | null;
  cpf?: string | null;
  currentStage?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
  latestOrder?: {
    id: string;
    productName: string;
    amount: number;
    currency: string;
    status: OrderStatus;
  } | null;
  tags?: LeadTag[];
}

export interface LeadTag {
  id: string;
  name: string;
  color?: string | null;
}

export interface CheckoutBoardCard {
  id: string;
  leadId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  columnId?: string | null;
  source?: string | null;
  temperature?: string | null;
  wasCheckoutOpportunity?: boolean;
  tags: LeadTag[];
  latestOrder?: {
    id: string;
    productName: string;
    amount: number;
    currency: string;
    status: OrderStatus;
    provider: Provider;
  } | null;
}

export interface CheckoutBoardData {
  funnel: {
    id: string;
    name: string;
  };
  columns: PipelineStage[];
  cards: CheckoutBoardCard[];
}

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  description?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface LeadNote {
  id: string;
  content: string;
  createdAt: string;
  authorName?: string | null;
}

export interface LeadTask {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  status: TaskStatus;
  assignedUserName?: string | null;
}

export interface MessageTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  content: string;
}

export interface WorkspaceTag {
  id: string;
  name: string;
  color: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  color?: string | null;
  position: number;
}

export interface PipelineData {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface RemotePipeline {
  id: string;
  name: string;
  isDefault: boolean;
  columns: Array<{ id: string; name: string; color: string; position: number }>;
}

export interface RemotePipelineBoard {
  funnel: { id: string; name: string };
  columns: Array<{ id: string; name: string; color: string; position: number }>;
  cards: Array<{
    id: string;
    leadId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    normalizedPhone?: string | null;
    avatarUrl: null;
    columnId: string | null;
    source?: string | null;
    temperature?: string | null;
    tags: Array<{ id: string; name: string; color?: string | null }>;
    latestOrder: {
      id: string;
      productName: string;
      amount: number;
      currency: string;
      status: string;
      provider: string;
    } | null;
  }>;
}

export interface LeadContext {
  lead: LeadSummary;
  timeline: TimelineItem[];
  notes: LeadNote[];
  tasks: LeadTask[];
  templates: MessageTemplate[];
  pipeline?: PipelineData | null;
}

export interface CurrentConversation {
  phone: string | null;
  label: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  apiBaseUrl?: string;
}

export interface LeadContextResponse {
  ok: boolean;
  data?: LeadContext | null;
  error?: string;
}

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface RemoteLeadMessage {
  id: string;
  direction: MessageDirection;
  content: string;
  sentAt: string;
}

export interface SyncMessageItem {
  direction: MessageDirection;
  content: string;
  sentAt: string;
  externalId?: string;
}

export type BackgroundRequest =
  | { type: 'auth:get-session' }
  | { type: 'auth:login'; payload: LoginPayload }
  | { type: 'auth:logout' }
  | { type: 'auth:update-base-url'; payload: { apiBaseUrl: string } }
  | { type: 'lead:fetch-context'; payload: { phone?: string | null; leadId?: string | null } }
  | { type: 'checkout:fetch-board' }
  | { type: 'workspace:fetch-templates' }
  | { type: 'workspace:fetch-tags' }
  | { type: 'lead:update-value'; payload: { leadId: string; amount: number; currency?: string; productName?: string } }
  | { type: 'lead:add-note'; payload: { leadId: string; content: string } }
  | { type: 'lead:create-task'; payload: { leadId: string; title: string; description?: string } }
  | { type: 'task:update-status'; payload: { taskId: string; status: TaskStatus } }
  | { type: 'lead:update-stage'; payload: { leadId: string; stageId: string } }
  | { type: 'pipeline:fetch-list' }
  | { type: 'pipeline:create'; payload: { name: string } }
  | { type: 'pipeline:rename'; payload: { id: string; name: string } }
  | { type: 'pipeline:delete'; payload: { id: string } }
  | { type: 'pipeline:fetch-board'; payload: { id: string } }
  | { type: 'pipeline:create-stage'; payload: { pipelineId: string; name: string; color: string } }
  | { type: 'pipeline:update-stage'; payload: { pipelineId: string; stageId: string; name: string; color: string } }
  | { type: 'pipeline:delete-stage'; payload: { pipelineId: string; stageId: string } }
  | { type: 'pipeline:reorder-stages'; payload: { pipelineId: string; stageId: string; targetStageId: string } }
  | {
      type: 'pipeline:assign-contact';
      payload: {
        pipelineId: string;
        stageId: string;
        name: string;
        phone?: string | null;
        email?: string | null;
        tagIds?: string[];
        originAmount?: number;
        originCurrency?: string;
        originProductName?: string;
        originOrderStatus?: string;
      };
    }
  | { type: 'lead:update-email'; payload: { leadId: string; email: string } }
  | { type: 'lead:add-tag'; payload: { leadId: string; name: string; color?: string } }
  | { type: 'lead:remove-tag'; payload: { leadId: string; tagId: string } }
  | { type: 'pipeline:move-card'; payload: { pipelineId: string; leadId: string; stageId: string } }
  | { type: 'pipeline:remove-card'; payload: { pipelineId: string; leadId: string } }
  | { type: 'lead:fetch-messages'; payload: { leadId: string; hours?: number } }
  | { type: 'lead:sync-messages'; payload: { leadId: string; messages: SyncMessageItem[] } }
  | { type: 'lead:update-phone'; payload: { leadId: string; phone: string } };

export type BackgroundResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };
