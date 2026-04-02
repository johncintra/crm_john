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

export type BackgroundRequest =
  | { type: 'auth:get-session' }
  | { type: 'auth:login'; payload: LoginPayload }
  | { type: 'auth:logout' }
  | { type: 'auth:update-base-url'; payload: { apiBaseUrl: string } }
  | { type: 'lead:fetch-context'; payload: { phone: string } }
  | { type: 'lead:add-note'; payload: { leadId: string; content: string } }
  | { type: 'lead:create-task'; payload: { leadId: string; title: string; description?: string } }
  | { type: 'task:update-status'; payload: { taskId: string; status: TaskStatus } }
  | { type: 'lead:update-stage'; payload: { leadId: string; stageId: string } };

export type BackgroundResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };
