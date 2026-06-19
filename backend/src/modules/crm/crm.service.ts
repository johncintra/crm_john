import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  CheckoutProvider,
  LeadTag,
  LeadEventType,
  LeadTemperature,
  OrderStatus,
  Prisma,
  TaskStatus
} from '@prisma/client';
import { ensureWorkspaceDefaultCrmSetup } from './default-workspace-setup';
import { INTERNAL_CHECKOUT_TOKEN, INTERNAL_WORKSPACE_NAME } from './internal-crm.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { IngestCheckoutEventDto } from './dto/ingest-checkout-event.dto';
import { SyncMessageItemDto } from './dto/sync-messages.dto';

const EVENT_TYPE_MAP: Record<LeadEventType, string> = {
  CHECKOUT_EVENT: 'checkout_event',
  PIPELINE: 'pipeline',
  NOTE: 'note',
  TASK: 'task',
  SYSTEM: 'system'
};

const CHECKOUT_TAG_NAMES = [
  'kiwify',
  'hotmart',
  'pix',
  'boleto',
  'aprovado',
  'recusado',
  'reembolso',
  'chargeback'
] as const;

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async findLeadByPhone(userId: string, phone: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const normalizedPhone = this.normalizePhone(phone);

    const lead = await this.prisma.lead.findFirst({
      where: {
        workspaceId,
        OR: [
          normalizedPhone ? { normalizedPhone } : undefined,
          { phone }
        ].filter(Boolean) as Prisma.LeadWhereInput[]
      },
      select: { id: true }
    });

    return lead;
  }

  async getLeadById(userId: string, leadId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const lead = await this.requireLead(workspaceId, leadId);
    return this.mapLeadSummary(lead);
  }

  async getLeadTimeline(userId: string, leadId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requireLead(workspaceId, leadId);

    const items = await this.prisma.leadTimelineEvent.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' }
    });

    return items.map((item) => ({
      id: item.id,
      type: EVENT_TYPE_MAP[item.type],
      title: item.title,
      description: item.description,
      timestamp: item.createdAt.toISOString(),
      metadata: item.metadata ?? {}
    }));
  }

  async getLeadNotes(userId: string, leadId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requireLead(workspaceId, leadId);

    const notes = await this.prisma.leadNote.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { name: true }
        }
      }
    });

    return notes.map((note) => ({
      id: note.id,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      authorName: note.author?.name ?? null
    }));
  }

  async getLeadTasks(userId: string, leadId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requireLead(workspaceId, leadId);

    const tasks = await this.prisma.leadTask.findMany({
      where: { leadId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedUser: {
          select: { name: true }
        }
      }
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt?.toISOString() ?? null,
      status: task.status,
      assignedUserName: task.assignedUser?.name ?? null
    }));
  }

  async addLeadNote(userId: string, leadId: string, dto: CreateNoteDto) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requireLead(workspaceId, leadId);

    await this.prisma.$transaction([
      this.prisma.leadNote.create({
        data: {
          leadId,
          authorId: userId,
          content: dto.content
        }
      }),
      this.prisma.leadTimelineEvent.create({
        data: {
          leadId,
          type: LeadEventType.NOTE,
          title: 'Nota adicionada',
          description: dto.content
        }
      })
    ]);

    return { ok: true };
  }

  async createLeadTask(userId: string, leadId: string, dto: CreateTaskDto) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requireLead(workspaceId, leadId);

    await this.prisma.$transaction([
      this.prisma.leadTask.create({
        data: {
          leadId,
          assignedUserId: userId,
          title: dto.title,
          description: dto.description,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null
        }
      }),
      this.prisma.leadTimelineEvent.create({
        data: {
          leadId,
          type: LeadEventType.TASK,
          title: 'Tarefa criada',
          description: dto.title
        }
      })
    ]);

    return { ok: true };
  }

  async syncLeadMessages(userId: string, leadId: string, messages: SyncMessageItemDto[]) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requireLead(workspaceId, leadId);

    if (!messages.length) {
      return { ok: true, synced: 0 };
    }

    const result = await this.prisma.leadMessage.createMany({
      data: messages.map((message) => ({
        leadId,
        direction: message.direction,
        content: message.content,
        sentAt: new Date(message.sentAt),
        externalId: message.externalId ?? null
      })),
      skipDuplicates: true
    });

    return { ok: true, synced: result.count };
  }

  async getLeadMessages(userId: string, leadId: string, sinceHours: number) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requireLead(workspaceId, leadId);

    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const messages = await this.prisma.leadMessage.findMany({
      where: { leadId, sentAt: { gte: since } },
      orderBy: { sentAt: 'asc' }
    });

    return messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      content: message.content,
      sentAt: message.sentAt.toISOString()
    }));
  }

  async updateTaskStatus(userId: string, taskId: string, status: TaskStatus) {
    const workspaceId = await this.getWorkspaceId(userId);
    const task = await this.prisma.leadTask.findFirst({
      where: {
        id: taskId,
        lead: {
          workspaceId
        }
      },
      include: {
        lead: true
      }
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.prisma.$transaction([
      this.prisma.leadTask.update({
        where: { id: taskId },
        data: { status }
      }),
      this.prisma.leadTimelineEvent.create({
        data: {
          leadId: task.leadId,
          type: LeadEventType.TASK,
          title: status === TaskStatus.DONE ? 'Tarefa concluída' : 'Tarefa atualizada',
          description: `${task.title} agora está como ${status}.`
        }
      })
    ]);

    return { ok: true };
  }

  async updateLeadStage(userId: string, leadId: string, stageId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const lead = await this.requireLead(workspaceId, leadId);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: {
        id: stageId,
        pipeline: {
          workspaceId
        }
      }
    });

    if (!stage) {
      throw new NotFoundException('Stage not found.');
    }

    await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          pipelineId: stage.pipelineId,
          currentStageId: stage.id
        }
      }),
      this.prisma.leadTimelineEvent.create({
        data: {
          leadId: lead.id,
          type: LeadEventType.PIPELINE,
          title: `Lead movido para ${stage.name}`
        }
      })
    ]);

    return { ok: true };
  }

  async getDefaultPipeline(userId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await ensureWorkspaceDefaultCrmSetup(this.prisma, workspaceId);
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        workspaceId,
        isDefault: true
      },
      include: {
        stages: {
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!pipeline) {
      return null;
    }

    return {
      id: pipeline.id,
      name: pipeline.name,
      stages: pipeline.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        position: stage.position
      }))
    };
  }

  async getCheckoutBoard(userId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const { checkoutPipeline } = await ensureWorkspaceDefaultCrmSetup(this.prisma, workspaceId);

    const leads = await this.prisma.lead.findMany({
      where: {
        workspaceId,
        pipelineId: checkoutPipeline.id
      },
      include: {
        currentStage: true,
        tags: {
          include: {
            tag: true
          }
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return {
      funnel: {
        id: checkoutPipeline.id,
        name: checkoutPipeline.name
      },
      columns: checkoutPipeline.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        position: stage.position
      })),
      cards: leads.map((lead) => {
        const latestOrder = lead.orders[0] ?? null;

        return {
          id: lead.id,
          leadId: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          normalizedPhone: lead.normalizedPhone,
          columnId: lead.currentStageId ?? checkoutPipeline.stages[0]?.id ?? null,
          source: lead.source,
          temperature: lead.temperature,
          tags: lead.tags.map((item) => ({
            id: item.tag.id,
            name: item.tag.name,
            color: item.tag.color
          })),
          latestOrder: latestOrder
            ? {
                id: latestOrder.id,
                productName: latestOrder.productName,
                amount: latestOrder.amount,
                currency: latestOrder.currency,
                status: latestOrder.status,
                provider: latestOrder.provider
              }
            : null
        };
      })
    };
  }

  async listTemplates(userId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const templates = await this.prisma.messageTemplate.findMany({
      where: { workspaceId },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }]
    });

    return templates.map((template) => ({
      id: template.id,
      title: template.title,
      category: template.category,
      content: template.content
    }));
  }

  async ingestCheckoutEvent(provider: CheckoutProvider, token: string, dto: IngestCheckoutEventDto) {
    let workspace = await this.prisma.workspace.findUnique({
      where: { checkoutToken: token }
    });

    if (!workspace && token === INTERNAL_CHECKOUT_TOKEN) {
      workspace = await this.prisma.workspace.create({
        data: {
          name: INTERNAL_WORKSPACE_NAME,
          checkoutToken: INTERNAL_CHECKOUT_TOKEN
        }
      });
      await ensureWorkspaceDefaultCrmSetup(this.prisma, workspace.id);
    }

    if (!workspace) {
      throw new ForbiddenException('Invalid checkout token.');
    }

    const { checkoutPipeline } = await ensureWorkspaceDefaultCrmSetup(this.prisma, workspace.id);

    const normalizedPhone = this.normalizePhone(dto.phone);
    const normalizedEmail = dto.email?.trim().toLowerCase() || null;
    if (!normalizedPhone) {
      throw new BadRequestException('A valid phone number is required.');
    }

    const targetStage = this.pickStageForOrderStatus(
      checkoutPipeline.stages,
      dto.status,
      dto.paymentMethod
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const tagRegistry = await this.loadCheckoutTags(tx, workspace.id);
      const existingLead =
        (await tx.lead.findFirst({
          where: { workspaceId: workspace.id, normalizedPhone }
        })) ??
        (normalizedEmail
          ? await tx.lead.findFirst({
              where: { workspaceId: workspace.id, email: normalizedEmail }
            })
          : null);

      const lead = existingLead ?? (await tx.lead.create({
        data: {
          workspaceId: workspace.id,
          pipelineId: checkoutPipeline.id,
          currentStageId: targetStage?.id ?? checkoutPipeline.stages[0]?.id ?? null,
          name: dto.name?.trim() || normalizedPhone,
          email: normalizedEmail || null,
          phone: dto.phone,
          normalizedPhone,
          source: dto.source?.trim() || `${provider} Checkout`,
          temperature: dto.temperature ?? this.temperatureFromOrderStatus(dto.status),
          cpf: dto.cpf?.trim() || null
        }
      }));

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          name: dto.name?.trim() || lead.name,
          email: normalizedEmail || lead.email,
          phone: dto.phone || lead.phone,
          normalizedPhone,
          source: dto.source?.trim() || lead.source,
          cpf: dto.cpf?.trim() || lead.cpf,
          temperature: dto.temperature ?? this.temperatureFromOrderStatus(dto.status),
          pipelineId: checkoutPipeline.id,
          currentStageId: targetStage?.id ?? lead.currentStageId
        }
      });

      const order =
        dto.externalId &&
        (await tx.order.findUnique({
          where: {
            workspaceId_provider_externalId: {
              workspaceId: workspace.id,
              provider,
              externalId: dto.externalId
            }
          }
        }));

      const nextOrder = order
        ? await tx.order.update({
            where: { id: order.id },
            data: {
              leadId: updatedLead.id,
              productName: dto.productName,
              amount: dto.amount,
              currency: dto.currency?.trim() || 'BRL',
              status: dto.status
            }
          })
        : await tx.order.create({
            data: {
              workspaceId: workspace.id,
              leadId: updatedLead.id,
              provider,
              externalId: dto.externalId ?? null,
              productName: dto.productName,
              amount: dto.amount,
              currency: dto.currency?.trim() || 'BRL',
              status: dto.status
            }
          });

      await tx.checkoutEvent.create({
        data: {
          workspaceId: workspace.id,
          leadId: updatedLead.id,
          orderId: nextOrder.id,
          provider,
          eventType: dto.eventType,
          externalId: dto.externalId ?? null,
          payload: (dto.metadata ?? {}) as Prisma.InputJsonValue
        }
      });

      await this.syncCheckoutTags(tx, updatedLead.id, tagRegistry, provider, dto.status, dto.paymentMethod);

      await tx.leadTimelineEvent.create({
        data: {
          leadId: updatedLead.id,
          type: LeadEventType.CHECKOUT_EVENT,
          title: this.timelineTitleFromStatus(dto.status, dto.paymentMethod),
          description:
            dto.description ??
            `${dto.productName} em ${provider} com status ${dto.status}.`,
          metadata: {
            provider,
            externalId: dto.externalId ?? null,
            amount: dto.amount,
            currency: dto.currency?.trim() || 'BRL',
            eventType: dto.eventType,
            paymentMethod: dto.paymentMethod ?? null
          }
        }
      });

      return {
        leadId: updatedLead.id,
        orderId: nextOrder.id
      };
    });

    return {
      ok: true,
      ...result
    };
  }

  mapKiwifyWebhookPayload(payload: Record<string, unknown>): IngestCheckoutEventDto {
    const phone =
      this.extractString(payload, ['customer.mobile', 'customer.phone', 'customer.cellphone', 'buyer.phone']) ??
      this.extractString(payload, ['Customer.mobile', 'Customer.phone']) ??
      '';

    return {
      phone,
      name:
        this.extractString(payload, ['customer.full_name', 'customer.name', 'buyer.name']) ??
        this.extractString(payload, ['Customer.full_name', 'Customer.name']) ??
        undefined,
      email:
        this.extractString(payload, ['customer.email', 'buyer.email']) ??
        this.extractString(payload, ['Customer.email']) ??
        undefined,
      cpf:
        this.extractString(payload, ['customer.document', 'customer.cpf', 'buyer.document']) ??
        this.extractString(payload, ['Customer.document']) ??
        undefined,
      source: 'Kiwify Checkout',
      productName:
        this.extractString(payload, ['product.name', 'offer.title', 'order.bump_name']) ??
        this.extractString(payload, ['Product.name']) ??
        'Produto Kiwify',
      amount: this.extractAmount(
        this.extractNumberLike(payload, [
          'commissionable_total_price',
          'order.total',
          'order.amount',
          'price'
        ])
      ),
      currency: this.extractString(payload, ['currency', 'order.currency']) ?? 'BRL',
      status: this.mapKiwifyStatus(
        this.extractString(payload, ['order_status', 'status', 'order.status']) ?? 'OPEN'
      ),
      eventType:
        this.extractString(payload, ['event', 'event_name', 'webhook_event_type']) ?? 'kiwify_event',
      externalId:
        this.extractString(payload, ['order_id', 'order.id', 'sale_id', 'id']) ?? undefined,
      description:
        this.extractString(payload, ['event_description']) ??
        undefined,
      paymentMethod:
        this.extractString(payload, ['payment_method', 'order.payment_method']) ??
        'UNKNOWN',
      metadata: payload
    };
  }

  async listPipelines(userId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const pipelines = await this.prisma.pipeline.findMany({
      where: { workspaceId, isCheckout: false },
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    return pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      columns: p.stages.map((s) => ({ id: s.id, name: s.name, color: s.color ?? '#64748b', position: s.position }))
    }));
  }

  async createPipeline(userId: string, name: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const pipeline = await this.prisma.pipeline.create({
      data: { workspaceId, name, isDefault: false, isCheckout: false },
      include: { stages: true }
    });
    return { id: pipeline.id, name: pipeline.name, isDefault: pipeline.isDefault, columns: [] };
  }

  async renamePipeline(userId: string, pipelineId: string, name: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requirePipeline(workspaceId, pipelineId);
    const updated = await this.prisma.pipeline.update({ where: { id: pipelineId }, data: { name } });
    return { id: updated.id, name: updated.name };
  }

  async deletePipeline(userId: string, pipelineId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const pipeline = await this.requirePipeline(workspaceId, pipelineId);
    if (pipeline.isDefault) throw new BadRequestException('O funil padrão não pode ser excluído.');
    await this.prisma.pipeline.delete({ where: { id: pipelineId } });
  }

  async getPipelineBoard(userId: string, pipelineId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const pipeline = await this.requirePipeline(workspaceId, pipelineId);
    const leads = await this.prisma.lead.findMany({
      where: { workspaceId, pipelineId },
      include: {
        currentStage: true,
        tags: { include: { tag: true } },
        orders: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
    return {
      funnel: { id: pipeline.id, name: pipeline.name },
      columns: pipeline.stages.map((s) => ({ id: s.id, name: s.name, color: s.color ?? '#64748b', position: s.position })),
      cards: leads.map((lead) => {
        const latestOrder = lead.orders[0] ?? null;
        return {
          id: lead.id,
          leadId: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          avatarUrl: null,
          columnId: lead.currentStageId ?? pipeline.stages[0]?.id ?? null,
          source: lead.source,
          temperature: lead.temperature,
          tags: lead.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
          latestOrder: latestOrder ? {
            id: latestOrder.id,
            productName: latestOrder.productName,
            amount: latestOrder.amount,
            currency: latestOrder.currency,
            status: latestOrder.status,
            provider: latestOrder.provider
          } : null
        };
      })
    };
  }

  async createStage(userId: string, pipelineId: string, name: string, color: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const pipeline = await this.requirePipeline(workspaceId, pipelineId);
    const maxPosition = pipeline.stages.reduce((max, s) => Math.max(max, s.position), 0);
    const stage = await this.prisma.pipelineStage.create({
      data: { pipelineId, name, color, position: maxPosition + 1 }
    });
    return { id: stage.id, name: stage.name, color: stage.color ?? color, position: stage.position };
  }

  async updateStage(userId: string, pipelineId: string, stageId: string, name: string, color: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requirePipeline(workspaceId, pipelineId);
    const stage = await this.prisma.pipelineStage.update({
      where: { id: stageId },
      data: { name, color }
    });
    return { id: stage.id, name: stage.name, color: stage.color ?? color, position: stage.position };
  }

  async deleteStage(userId: string, pipelineId: string, stageId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requirePipeline(workspaceId, pipelineId);
    await this.prisma.lead.updateMany({ where: { currentStageId: stageId }, data: { currentStageId: null } });
    await this.prisma.pipelineStage.delete({ where: { id: stageId } });
  }

  async reorderStages(userId: string, pipelineId: string, stageId: string, targetStageId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    const pipeline = await this.requirePipeline(workspaceId, pipelineId);
    const stages = [...pipeline.stages].sort((a, b) => a.position - b.position);
    const fromIdx = stages.findIndex((s) => s.id === stageId);
    const toIdx = stages.findIndex((s) => s.id === targetStageId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [moved] = stages.splice(fromIdx, 1);
    stages.splice(toIdx, 0, moved);
    await this.prisma.$transaction(
      stages.map((s, i) => this.prisma.pipelineStage.update({ where: { id: s.id }, data: { position: i + 1 } }))
    );
  }

  async assignContactToStage(userId: string, pipelineId: string, stageId: string, contact: { name: string; phone?: string | null }) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requirePipeline(workspaceId, pipelineId);
    const normalizedPhone = this.normalizePhone(contact.phone);
    let lead = normalizedPhone
      ? await this.prisma.lead.findFirst({ where: { workspaceId, pipelineId, normalizedPhone } })
      : null;
    if (lead) {
      lead = await this.prisma.lead.update({ where: { id: lead.id }, data: { currentStageId: stageId, name: contact.name } });
    } else {
      lead = await this.prisma.lead.create({
        data: { workspaceId, pipelineId, name: contact.name, phone: contact.phone, normalizedPhone, currentStageId: stageId }
      });
    }
    return { id: lead.id, leadId: lead.id, name: lead.name, phone: lead.phone, email: lead.email, avatarUrl: null, columnId: stageId, source: lead.source, temperature: lead.temperature, tags: [], latestOrder: null };
  }

  async moveCard(userId: string, pipelineId: string, leadId: string, stageId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requirePipeline(workspaceId, pipelineId);
    await this.prisma.lead.update({ where: { id: leadId }, data: { currentStageId: stageId } });
  }

  async removeCard(userId: string, pipelineId: string, leadId: string) {
    const workspaceId = await this.getWorkspaceId(userId);
    await this.requirePipeline(workspaceId, pipelineId);
    await this.prisma.lead.update({ where: { id: leadId }, data: { currentStageId: null } });
  }

  private async requirePipeline(workspaceId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, workspaceId, isCheckout: false },
      include: { stages: { orderBy: { position: 'asc' } } }
    });
    if (!pipeline) throw new NotFoundException('Pipeline não encontrado.');
    return pipeline;
  }

  private async getWorkspaceId(userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });

    if (!membership) {
      throw new ForbiddenException('User has no workspace access.');
    }

    return membership.workspaceId;
  }

  private async requireLead(workspaceId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId
      },
      include: {
        currentStage: true,
        tags: {
          include: {
            tag: true
          }
        },
        orders: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found.');
    }

    return lead;
  }

  private mapLeadSummary(
    lead: Awaited<ReturnType<CrmService['requireLead']>>
  ) {
    const latestOrder = lead.orders[0];

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      normalizedPhone: lead.normalizedPhone,
      source: lead.source,
      temperature: lead.temperature,
      cpf: lead.cpf,
      currentStage: lead.currentStage
        ? {
            id: lead.currentStage.id,
            name: lead.currentStage.name,
            color: lead.currentStage.color
          }
        : null,
      latestOrder: latestOrder
        ? {
            id: latestOrder.id,
            productName: latestOrder.productName,
            amount: latestOrder.amount,
            currency: latestOrder.currency,
            status: latestOrder.status
          }
        : null,
      tags: lead.tags.map((item) => ({
        id: item.tag.id,
        name: item.tag.name,
        color: item.tag.color
      }))
    };
  }

  private normalizePhone(phone?: string | null) {
    if (!phone) {
      return null;
    }

    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 ? digits : null;
  }

  private async loadCheckoutTags(tx: Prisma.TransactionClient, workspaceId: string) {
    const tags = await tx.leadTag.findMany({
      where: {
        workspaceId,
        name: {
          in: [...CHECKOUT_TAG_NAMES]
        }
      }
    });

    return new Map(tags.map((tag) => [tag.name, tag]));
  }

  private async syncCheckoutTags(
    tx: Prisma.TransactionClient,
    leadId: string,
    tagRegistry: Map<string, LeadTag>,
    provider: CheckoutProvider,
    status: OrderStatus,
    paymentMethod?: string | null
  ) {
    const desiredTagNames = new Set<string>();
    desiredTagNames.add(provider === CheckoutProvider.KIWIFY ? 'kiwify' : 'hotmart');

    const normalizedPaymentMethod = (paymentMethod ?? '').trim().toLowerCase();
    if (normalizedPaymentMethod.includes('pix')) {
      desiredTagNames.add('pix');
    }
    if (normalizedPaymentMethod.includes('boleto') || normalizedPaymentMethod.includes('bank_slip')) {
      desiredTagNames.add('boleto');
    }

    switch (status) {
      case OrderStatus.APPROVED:
        desiredTagNames.add('aprovado');
        break;
      case OrderStatus.DECLINED:
        desiredTagNames.add('recusado');
        break;
      case OrderStatus.REFUNDED:
        desiredTagNames.add('reembolso');
        break;
      case OrderStatus.CHARGEBACK:
        desiredTagNames.add('chargeback');
        break;
      default:
        break;
    }

    const relevantTagIds = [...tagRegistry.values()].map((tag) => tag.id);
    await tx.leadTagOnLead.deleteMany({
      where: {
        leadId,
        tagId: {
          in: relevantTagIds
        }
      }
    });

    const tagLinks = [...desiredTagNames]
      .map((name) => tagRegistry.get(name))
      .filter((tag): tag is LeadTag => Boolean(tag))
      .map((tag) => ({
        leadId,
        tagId: tag.id
      }));

    if (tagLinks.length) {
      await tx.leadTagOnLead.createMany({
        data: tagLinks,
        skipDuplicates: true
      });
    }
  }

  private extractString(payload: Record<string, unknown>, paths: string[]) {
    for (const path of paths) {
      const value = this.readPath(payload, path);
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private extractNumberLike(payload: Record<string, unknown>, paths: string[]) {
    for (const path of paths) {
      const value = this.readPath(payload, path);
      if (typeof value === 'number' || typeof value === 'string') {
        return value;
      }
    }

    return null;
  }

  private readPath(payload: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null;
      }

      return (current as Record<string, unknown>)[key] ?? null;
    }, payload);
  }

  private extractAmount(rawValue: string | number | null) {
    if (typeof rawValue === 'number') {
      return rawValue > 1000 ? Math.round(rawValue) : Math.round(rawValue * 100);
    }

    if (typeof rawValue !== 'string') {
      return 0;
    }

    const normalized = rawValue.replace(/[^\d.,-]/g, '').trim();
    if (!normalized) {
      return 0;
    }

    if (normalized.includes(',') || normalized.includes('.')) {
      const decimal = normalized.replace(/\./g, '').replace(',', '.');
      const parsed = Number(decimal);
      return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
    }

    const digits = Number(normalized);
    return Number.isFinite(digits) ? digits : 0;
  }

  private mapKiwifyStatus(status: string): OrderStatus {
    const normalized = status.trim().toLowerCase();

    if (['paid', 'approved', 'completed', 'order_approved'].includes(normalized)) {
      return OrderStatus.APPROVED;
    }

    if (['refunded', 'refund', 'refused_refund'].includes(normalized)) {
      return OrderStatus.REFUNDED;
    }

    if (['chargedback', 'chargeback'].includes(normalized)) {
      return OrderStatus.CHARGEBACK;
    }

    if (['waiting_payment', 'pending', 'billet_printed', 'pix_generated'].includes(normalized)) {
      return OrderStatus.PENDING;
    }

    if (['refused', 'declined', 'rejected', 'failed'].includes(normalized)) {
      return OrderStatus.DECLINED;
    }

    if (['abandoned', 'canceled', 'cancelled', 'expired'].includes(normalized)) {
      return OrderStatus.ABANDONED;
    }

    return OrderStatus.OPEN;
  }

  private pickStageForOrderStatus(
    stages: Array<{ id: string; name: string; color: string | null; position: number }>,
    status: OrderStatus,
    paymentMethod?: string | null
  ) {
    const normalizedPaymentMethod = (paymentMethod ?? '').trim().toLowerCase();
    const isPix = normalizedPaymentMethod.includes('pix');
    const isBoleto =
      normalizedPaymentMethod.includes('boleto') ||
      normalizedPaymentMethod.includes('billet') ||
      normalizedPaymentMethod.includes('bank_slip');

    const targetName = {
      APPROVED: 'compra aprovada',
      DECLINED: 'compra recusada',
      PENDING: isBoleto ? 'boleto gerado' : 'pix gerado',
      OPEN: isBoleto ? 'boleto gerado' : isPix ? 'pix gerado' : 'carrinho abandonado',
      ABANDONED: 'carrinho abandonado',
      REFUNDED: 'reembolso',
      CHARGEBACK: 'chargeback'
    }[status];

    return stages.find((stage) => stage.name.trim().toLowerCase() === targetName) ?? null;
  }

  private timelineTitleFromStatus(status: OrderStatus, paymentMethod?: string | null) {
    const normalizedPaymentMethod = (paymentMethod ?? '').trim().toLowerCase();
    const isPix = normalizedPaymentMethod.includes('pix');
    const isBoleto =
      normalizedPaymentMethod.includes('boleto') ||
      normalizedPaymentMethod.includes('billet') ||
      normalizedPaymentMethod.includes('bank_slip');

    switch (status) {
      case OrderStatus.APPROVED:
        return 'Compra aprovada';
      case OrderStatus.PENDING:
        return isBoleto ? 'Boleto gerado' : 'Pix gerado';
      case OrderStatus.DECLINED:
        return 'Compra recusada';
      case OrderStatus.ABANDONED:
        return 'Carrinho abandonado';
      case OrderStatus.REFUNDED:
        return 'Reembolso registrado';
      case OrderStatus.CHARGEBACK:
        return 'Chargeback registrado';
      default:
        return isBoleto ? 'Boleto gerado' : isPix ? 'Pix gerado' : 'Checkout iniciado';
    }
  }

  private temperatureFromOrderStatus(status: OrderStatus): LeadTemperature {
    switch (status) {
      case OrderStatus.APPROVED:
        return LeadTemperature.HOT;
      case OrderStatus.PENDING:
      case OrderStatus.OPEN:
      case OrderStatus.ABANDONED:
        return LeadTemperature.WARM;
      default:
        return LeadTemperature.COLD;
    }
  }
}
