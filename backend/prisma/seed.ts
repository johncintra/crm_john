import {
  CheckoutProvider,
  LeadEventType,
  LeadTemperature,
  MembershipRole,
  OrderStatus,
  PrismaClient,
  TaskStatus,
  TemplateCategory
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ensureWorkspaceDefaultCrmSetup } from '../src/modules/crm/default-workspace-setup';

const prisma = new PrismaClient();

async function main() {
  const email = 'jhonattan.cintra@gmail.com';
  const password = '123277';
  const workspaceName = 'CRM John Workspace';

  const passwordHash = await bcrypt.hash(password, 10);

  const workspace = await prisma.workspace.upsert({
    where: {
      id: 'workspace_default_seed'
    },
    update: {
      name: workspaceName,
      checkoutToken: 'seed-checkout-token'
    },
    create: {
      id: 'workspace_default_seed',
      name: workspaceName,
      checkoutToken: 'seed-checkout-token'
    }
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Jhonattan Cintra',
      passwordHash
    },
    create: {
      name: 'Jhonattan Cintra',
      email,
      passwordHash
    }
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id
      }
    },
    update: {
      role: MembershipRole.OWNER
    },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: MembershipRole.OWNER
    }
  });

  const { checkoutPipeline } = await ensureWorkspaceDefaultCrmSetup(prisma, workspace.id);
  const approvedStageId =
    checkoutPipeline.stages.find((stage) => stage.name === 'Compra Aprovada')?.id ??
    checkoutPipeline.stages[0]?.id;

  const lead = await prisma.lead.upsert({
    where: {
      id: 'lead_seed_mariana'
    },
    update: {
      workspaceId: workspace.id,
      pipelineId: checkoutPipeline.id,
      currentStageId: approvedStageId,
      name: 'Mariana Costa',
      email: 'mariana.costa@email.com',
      phone: '+55 11 99876-5432',
      normalizedPhone: '5511998765432',
      source: 'Kiwify - Campanha Meta Ads',
      temperature: LeadTemperature.HOT
    },
    create: {
      id: 'lead_seed_mariana',
      workspaceId: workspace.id,
      pipelineId: checkoutPipeline.id,
      currentStageId: approvedStageId,
      name: 'Mariana Costa',
      email: 'mariana.costa@email.com',
      phone: '+55 11 99876-5432',
      normalizedPhone: '5511998765432',
      source: 'Kiwify - Campanha Meta Ads',
      temperature: LeadTemperature.HOT
    }
  });

  const tags = [
    { id: 'tag_seed_kiwify', name: 'kiwify', color: '#3b82f6' },
    { id: 'tag_seed_aprovado', name: 'aprovado', color: '#22c55e' }
  ];

  for (const tag of tags) {
    const persistedTag = await prisma.leadTag.upsert({
      where: {
        workspaceId_name: {
          workspaceId: workspace.id,
          name: tag.name
        }
      },
      update: {
        color: tag.color
      },
      create: {
        id: tag.id,
        workspaceId: workspace.id,
        name: tag.name,
        color: tag.color
      }
    });

    await prisma.leadTagOnLead.upsert({
      where: {
        leadId_tagId: {
          leadId: lead.id,
          tagId: persistedTag.id
        }
      },
      update: {},
      create: {
        leadId: lead.id,
        tagId: persistedTag.id
      }
    });
  }

  await prisma.order.upsert({
    where: {
      workspaceId_provider_externalId: {
        workspaceId: workspace.id,
        provider: CheckoutProvider.KIWIFY,
        externalId: 'kiwify-order-seed-1'
      }
    },
    update: {
      leadId: lead.id,
      productName: 'Mentoria Comercial Premium',
      amount: 199700,
      currency: 'BRL',
      status: OrderStatus.APPROVED
    },
    create: {
      leadId: lead.id,
      workspaceId: workspace.id,
      provider: CheckoutProvider.KIWIFY,
      externalId: 'kiwify-order-seed-1',
      productName: 'Mentoria Comercial Premium',
      amount: 199700,
      currency: 'BRL',
      status: OrderStatus.APPROVED
    }
  });

  const notes = [
    {
      id: 'lead_note_seed_1',
      content: 'Lead demonstrou urgência e comparou a oferta com um concorrente direto.'
    },
    {
      id: 'lead_note_seed_2',
      content: 'Foi enviada prova social e detalhamento do suporte pós-compra.'
    }
  ];

  for (const note of notes) {
    await prisma.leadNote.upsert({
      where: { id: note.id },
      update: {
        content: note.content,
        authorId: user.id,
        leadId: lead.id
      },
      create: {
        id: note.id,
        leadId: lead.id,
        authorId: user.id,
        content: note.content
      }
    });
  }

  const tasks = [
    {
      id: 'lead_task_seed_1',
      title: 'Confirmar recebimento do acesso',
      description: 'Verificar se a cliente conseguiu entrar na área de membros.',
      status: TaskStatus.OPEN
    },
    {
      id: 'lead_task_seed_2',
      title: 'Enviar mensagem de boas-vindas',
      description: 'Usar template de compra aprovada com CTA para próximo passo.',
      status: TaskStatus.DONE
    }
  ];

  for (const task of tasks) {
    await prisma.leadTask.upsert({
      where: { id: task.id },
      update: {
        leadId: lead.id,
        assignedUserId: user.id,
        title: task.title,
        description: task.description,
        status: task.status
      },
      create: {
        id: task.id,
        leadId: lead.id,
        assignedUserId: user.id,
        title: task.title,
        description: task.description,
        status: task.status
      }
    });
  }

  const timeline = [
    {
      id: 'timeline_seed_1',
      type: LeadEventType.CHECKOUT_EVENT,
      title: 'Checkout iniciado',
      description: 'Lead entrou no checkout após clicar no CTA principal da landing page.'
    },
    {
      id: 'timeline_seed_2',
      type: LeadEventType.CHECKOUT_EVENT,
      title: 'Pix gerado',
      description: 'Pagamento via Pix foi gerado e aguardava compensação.'
    },
    {
      id: 'timeline_seed_3',
      type: LeadEventType.NOTE,
      title: 'Nota adicionada',
      description: 'Lead pediu confirmação de bônus antes de concluir o pagamento.'
    },
    {
      id: 'timeline_seed_4',
      type: LeadEventType.PIPELINE,
      title: 'Lead movido para Em Atendimento',
      description: 'Atendente assumiu a conversa e enviou suporte consultivo.'
    },
    {
      id: 'timeline_seed_5',
      type: LeadEventType.CHECKOUT_EVENT,
      title: 'Compra aprovada',
      description: 'Pagamento confirmado e pedido aprovado com sucesso.'
    }
  ];

  for (const event of timeline) {
    await prisma.leadTimelineEvent.upsert({
      where: { id: event.id },
      update: {
        leadId: lead.id,
        type: event.type,
        title: event.title,
        description: event.description
      },
      create: {
        id: event.id,
        leadId: lead.id,
        type: event.type,
        title: event.title,
        description: event.description
      }
    });
  }

  const templates = [
    {
      id: 'template_seed_1',
      title: 'Pix pendente',
      category: TemplateCategory.PIX_PENDING,
      content:
        'Vi que seu pagamento ficou pendente. Se quiser, posso te mandar o link novamente para concluir agora.'
    },
    {
      id: 'template_seed_2',
      title: 'Cartão recusado',
      category: TemplateCategory.CREDIT_CARD_DECLINED,
      content:
        'Seu pagamento no cartão não foi concluído. Se quiser, posso te enviar a opção por Pix agora.'
    },
    {
      id: 'template_seed_3',
      title: 'Compra aprovada',
      category: TemplateCategory.PURCHASE_APPROVED,
      content:
        'Pagamento aprovado com sucesso. Agora vou te passar o próximo passo para acessar tudo.'
    },
    {
      id: 'template_seed_4',
      title: 'Follow-up geral',
      category: TemplateCategory.GENERAL,
      content:
        'Passei aqui para te ajudar a concluir isso da forma mais rápida. Se quiser, posso te orientar agora.'
    }
  ];

  for (const template of templates) {
    await prisma.messageTemplate.upsert({
      where: { id: template.id },
      update: {
        workspaceId: workspace.id,
        title: template.title,
        category: template.category,
        content: template.content
      },
      create: {
        id: template.id,
        workspaceId: workspace.id,
        title: template.title,
        category: template.category,
        content: template.content
      }
    });
  }

  console.log('Seed concluído.');
  console.log(`Login: ${email}`);
  console.log(`Senha: ${password}`);
  console.log(`Checkout token: ${workspace.checkoutToken}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
