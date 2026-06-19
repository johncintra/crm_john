import type { Prisma, PrismaClient, TemplateCategory } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

type StageSeed = {
  name: string;
  color: string;
  position: number;
};

type PipelineSeed = {
  name: string;
  isDefault: boolean;
  isCheckout?: boolean;
  stages: StageSeed[];
};

const GENERAL_PIPELINE: PipelineSeed = {
  name: 'CRM General (Funil Principal)',
  isDefault: true,
  stages: [
    { name: 'Novo Lead', color: '#64748b', position: 1 },
    { name: 'Em Atendimento', color: '#38bdf8', position: 2 },
    { name: 'Proposta', color: '#f59e0b', position: 3 },
    { name: 'Negociação', color: '#c084fc', position: 4 },
    { name: 'Cliente', color: '#22c55e', position: 5 },
    { name: 'Perdido', color: '#94a3b8', position: 6 }
  ]
};

const CHECKOUT_PIPELINE: PipelineSeed = {
  name: 'Checkout',
  isDefault: false,
  isCheckout: true,
  stages: [
    { name: 'Boleto Gerado', color: '#a78bfa', position: 1 },
    { name: 'Pix Gerado', color: '#06b6d4', position: 2 },
    { name: 'Carrinho Abandonado', color: '#94a3b8', position: 3 },
    { name: 'Compra Recusada', color: '#ef4444', position: 4 },
    { name: 'Reembolso', color: '#f59e0b', position: 5 },
    { name: 'Chargeback', color: '#7c3aed', position: 6 },
    { name: 'Aguardando Compra', color: '#facc15', position: 7 },
    { name: 'Compra Aprovada', color: '#22c55e', position: 8 }
  ]
};

const CHECKOUT_TAGS = [
  { name: 'kiwify', color: '#3b82f6' },
  { name: 'hotmart', color: '#f97316' },
  { name: 'pix', color: '#06b6d4' },
  { name: 'boleto', color: '#a78bfa' },
  { name: 'aprovado', color: '#22c55e' },
  { name: 'recusado', color: '#ef4444' },
  { name: 'reembolso', color: '#f59e0b' },
  { name: 'chargeback', color: '#7c3aed' }
];

const DEFAULT_TEMPLATES: Array<{ title: string; category: TemplateCategory; content: string }> = [
  {
    title: 'Pix Pendente',
    category: 'PIX_PENDING',
    content: 'Oi! Vi que seu pagamento via Pix foi gerado. Se quiser, posso te ajudar a finalizar agora.'
  },
  {
    title: 'Cartão Recusado',
    category: 'CREDIT_CARD_DECLINED',
    content: 'Oi! Seu pagamento no cartão não foi aprovado. Se quiser, posso te ajudar com outro cartão ou Pix.'
  },
  {
    title: 'Compra Aprovada',
    category: 'PURCHASE_APPROVED',
    content: 'Parabéns pela compra. Se precisar de ajuda com o acesso, me chama aqui.'
  }
];

export async function ensureWorkspaceDefaultCrmSetup(db: DbClient, workspaceId: string) {
  const generalPipeline = await ensurePipeline(db, workspaceId, GENERAL_PIPELINE);
  const checkoutPipeline = await ensurePipeline(db, workspaceId, CHECKOUT_PIPELINE);
  await migrateLegacyCheckoutStages(db, checkoutPipeline.id);

  await ensureCheckoutTags(db, workspaceId);
  await ensureDefaultTemplates(db, workspaceId);

  return {
    generalPipeline,
    checkoutPipeline
  };
}

async function ensurePipeline(db: DbClient, workspaceId: string, seed: PipelineSeed) {
  let pipeline = await db.pipeline.findFirst({
    where: {
      workspaceId,
      name: seed.name
    }
  });

  if (!pipeline) {
    pipeline = await db.pipeline.create({
      data: {
        workspaceId,
        name: seed.name,
        isDefault: seed.isDefault,
        isCheckout: seed.isCheckout ?? false
      }
    });

    // Seed default stages only at pipeline creation time. Doing this on every
    // call would resurrect stages the user deliberately deleted later.
    for (const stage of seed.stages) {
      await db.pipelineStage.create({
        data: {
          pipelineId: pipeline.id,
          name: stage.name,
          color: stage.color,
          position: stage.position
        }
      });
    }
  } else if (pipeline.isDefault !== seed.isDefault) {
    pipeline = await db.pipeline.update({
      where: { id: pipeline.id },
      data: { isDefault: seed.isDefault, isCheckout: seed.isCheckout ?? false }
    });
  }

  return db.pipeline.findUniqueOrThrow({
    where: { id: pipeline.id },
    include: {
      stages: {
        orderBy: { position: 'asc' }
      }
    }
  });
}

async function ensureCheckoutTags(db: DbClient, workspaceId: string) {
  for (const tag of CHECKOUT_TAGS) {
    const existingTag = await db.leadTag.findFirst({
      where: {
        workspaceId,
        name: tag.name
      }
    });

    if (existingTag) {
      await db.leadTag.update({
        where: { id: existingTag.id },
        data: { color: tag.color }
      });
      continue;
    }

    await db.leadTag.create({
      data: {
        workspaceId,
        name: tag.name,
        color: tag.color
      }
    });
  }
}

async function ensureDefaultTemplates(db: DbClient, workspaceId: string) {
  for (const template of DEFAULT_TEMPLATES) {
    const existingTemplate = await db.messageTemplate.findFirst({
      where: {
        workspaceId,
        title: template.title
      }
    });

    if (existingTemplate) {
      continue;
    }

    await db.messageTemplate.create({
      data: {
        workspaceId,
        title: template.title,
        category: template.category,
        content: template.content
      }
    });
  }
}

async function migrateLegacyCheckoutStages(db: DbClient, pipelineId: string) {
  const stages = await db.pipelineStage.findMany({
    where: { pipelineId },
    orderBy: { position: 'asc' }
  });

  const stageMap = new Map(stages.map((stage) => [stage.name.trim().toLowerCase(), stage]));
  const legacyStages = stages.filter((stage) =>
    ['checkout iniciado', 'pix pendente', 'cartão recusado', 'perdido'].includes(
      stage.name.trim().toLowerCase()
    )
  );

  if (!legacyStages.length) {
    return;
  }

  const leads = await db.lead.findMany({
    where: {
      pipelineId,
      currentStageId: {
        in: legacyStages.map((stage) => stage.id)
      }
    },
    include: {
      tags: {
        include: {
          tag: true
        }
      }
    }
  });

  for (const lead of leads) {
    const currentStage = legacyStages.find((stage) => stage.id === lead.currentStageId);
    if (!currentStage) {
      continue;
    }

    const normalizedStageName = currentStage.name.trim().toLowerCase();
    const hasChargebackTag = lead.tags.some((item) => item.tag.name === 'chargeback');
    const hasRefundTag = lead.tags.some((item) => item.tag.name === 'reembolso');

    const nextStageName =
      normalizedStageName === 'checkout iniciado'
        ? 'carrinho abandonado'
        : normalizedStageName === 'pix pendente'
          ? 'pix gerado'
          : normalizedStageName === 'cartão recusado'
            ? 'compra recusada'
            : hasChargebackTag
              ? 'chargeback'
              : hasRefundTag
                ? 'reembolso'
                : 'carrinho abandonado';

    const nextStage = stageMap.get(nextStageName);
    if (!nextStage || nextStage.id === currentStage.id) {
      continue;
    }

    await db.lead.update({
      where: { id: lead.id },
      data: {
        currentStageId: nextStage.id
      }
    });
  }

  for (const stage of legacyStages) {
    const leadsStillUsingStage = await db.lead.count({
      where: {
        currentStageId: stage.id
      }
    });

    if (leadsStillUsingStage === 0) {
      await db.pipelineStage.delete({
        where: { id: stage.id }
      });
    }
  }
}
