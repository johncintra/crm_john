import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  CheckoutProvider,
  LeadEventType,
  LeadTemperature,
  OrderStatus,
  Prisma,
  TaskStatus
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { IngestCheckoutEventDto } from './dto/ingest-checkout-event.dto';

const EVENT_TYPE_MAP: Record<LeadEventType, string> = {
  CHECKOUT_EVENT: 'checkout_event',
  PIPELINE: 'pipeline',
  NOTE: 'note',
  TASK: 'task',
  SYSTEM: 'system'
};

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
    const workspace = await this.prisma.workspace.findUnique({
      where: { checkoutToken: token }
    });

    if (!workspace) {
      throw new ForbiddenException('Invalid checkout token.');
    }

    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        workspaceId: workspace.id,
        isDefault: true
      },
      include: {
        stages: {
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!pipeline) {
      throw new BadRequestException('Workspace has no default pipeline.');
    }

    const normalizedPhone = this.normalizePhone(dto.phone);
    if (!normalizedPhone) {
      throw new BadRequestException('A valid phone number is required.');
    }

    const targetStage = this.pickStageForOrderStatus(pipeline.stages, dto.status);

    const result = await this.prisma.$transaction(async (tx) => {
      const lead =
        (await tx.lead.findFirst({
          where: {
            workspaceId: workspace.id,
            normalizedPhone
          }
        })) ??
        (await tx.lead.create({
          data: {
            workspaceId: workspace.id,
            pipelineId: pipeline.id,
            currentStageId: targetStage?.id ?? pipeline.stages[0]?.id ?? null,
            name: dto.name?.trim() || normalizedPhone,
            email: dto.email?.trim() || null,
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
          email: dto.email?.trim() || lead.email,
          phone: dto.phone || lead.phone,
          normalizedPhone,
          source: dto.source?.trim() || lead.source,
          cpf: dto.cpf?.trim() || lead.cpf,
          temperature: dto.temperature ?? this.temperatureFromOrderStatus(dto.status),
          pipelineId: targetStage ? pipeline.id : lead.pipelineId,
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

      await tx.leadTimelineEvent.create({
        data: {
          leadId: updatedLead.id,
          type: LeadEventType.CHECKOUT_EVENT,
          title: this.timelineTitleFromStatus(dto.status),
          description:
            dto.description ??
            `${dto.productName} em ${provider} com status ${dto.status}.`,
          metadata: {
            provider,
            externalId: dto.externalId ?? null,
            amount: dto.amount,
            currency: dto.currency?.trim() || 'BRL',
            eventType: dto.eventType
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

  private pickStageForOrderStatus(
    stages: Array<{ id: string; name: string; color: string | null; position: number }>,
    status: OrderStatus
  ) {
    const targetName = {
      APPROVED: 'compra aprovada',
      DECLINED: 'cartão recusado',
      PENDING: 'pix pendente',
      OPEN: 'checkout iniciado',
      ABANDONED: 'checkout iniciado',
      REFUNDED: 'perdido',
      CHARGEBACK: 'perdido'
    }[status];

    return stages.find((stage) => stage.name.trim().toLowerCase() === targetName) ?? null;
  }

  private timelineTitleFromStatus(status: OrderStatus) {
    switch (status) {
      case OrderStatus.APPROVED:
        return 'Compra aprovada';
      case OrderStatus.PENDING:
        return 'Pix gerado';
      case OrderStatus.DECLINED:
        return 'Cartão recusado';
      case OrderStatus.ABANDONED:
        return 'Checkout abandonado';
      case OrderStatus.REFUNDED:
        return 'Reembolso registrado';
      case OrderStatus.CHARGEBACK:
        return 'Chargeback registrado';
      default:
        return 'Checkout iniciado';
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
