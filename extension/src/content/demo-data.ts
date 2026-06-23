import type { LeadContext } from '../shared/types';

export interface DemoBoardLead {
  id: string;
  name: string;
  phone: string;
  stageId: string;
}

export const demoLeadContext: LeadContext = {
  lead: {
    id: 'demo-lead-1',
    name: 'Mariana Costa',
    email: 'mariana.costa@email.com',
    phone: '+55 11 99876-5432',
    normalizedPhone: '5511998765432',
    source: 'Kiwify - Campanha Meta Ads',
    temperature: 'HOT',
    currentStage: {
      id: 'stage-approved',
      name: 'Compra Aprovada',
      color: '#7c3aed'
    },
    latestOrder: {
      id: 'demo-order-1',
      productName: 'Mentoria Comercial Premium',
      amount: 199700,
      currency: 'BRL',
      status: 'APPROVED'
    },
    tags: [
      { id: 'tag-1', name: 'Lead Quente', color: '#7c3aed' },
      { id: 'tag-2', name: 'Pix', color: '#38bdf8' },
      { id: 'tag-3', name: 'Recuperado', color: '#f59e0b' }
    ]
  },
  pipeline: {
    id: 'pipeline-1',
    name: 'Pipeline Comercial',
    stages: [
      { id: 'stage-new', name: 'Novo Lead', position: 1, color: '#64748b' },
      { id: 'stage-checkout', name: 'Checkout Iniciado', position: 2, color: '#38bdf8' },
      { id: 'stage-pix', name: 'Pix Pendente', position: 3, color: '#f59e0b' },
      { id: 'stage-declined', name: 'Cartão Recusado', position: 4, color: '#fb7185' },
      { id: 'stage-service', name: 'Em Atendimento', position: 5, color: '#c084fc' },
      { id: 'stage-recovered', name: 'Recuperado', position: 6, color: '#22c55e' },
      { id: 'stage-approved', name: 'Compra Aprovada', position: 7, color: '#7c3aed' },
      { id: 'stage-lost', name: 'Perdido', position: 8, color: '#94a3b8' }
    ]
  },
  timeline: [
    {
      id: 'tl-1',
      type: 'checkout_event',
      title: 'Checkout iniciado',
      description: 'Lead entrou no checkout após clicar no CTA principal da landing page.',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    },
    {
      id: 'tl-2',
      type: 'checkout_event',
      title: 'Pix gerado',
      description: 'Pagamento via Pix foi gerado e aguardava compensação.',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    },
    {
      id: 'tl-3',
      type: 'note',
      title: 'Nota adicionada',
      description: 'Lead pediu confirmação de bônus antes de concluir o pagamento.',
      timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString()
    },
    {
      id: 'tl-4',
      type: 'pipeline',
      title: 'Lead movido para Em Atendimento',
      description: 'Atendente assumiu a conversa e enviou suporte consultivo.',
      timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString()
    },
    {
      id: 'tl-5',
      type: 'checkout_event',
      title: 'Compra aprovada',
      description: 'Pagamento confirmado e pedido aprovado com sucesso.',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString()
    },
    {
      id: 'tl-6',
      type: 'task',
      title: 'Tarefa concluída',
      description: 'Enviar onboarding inicial e liberar acesso.',
      timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString()
    }
  ],
  notes: [
    {
      id: 'note-1',
      content: 'Lead demonstrou urgência e comparou a oferta com um concorrente direto.',
      createdAt: new Date(Date.now() - 1000 * 60 * 100).toISOString(),
      authorName: 'Jhonattan'
    },
    {
      id: 'note-2',
      content: 'Foi enviada prova social e detalhamento do suporte pós-compra.',
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      authorName: 'Equipe Comercial'
    }
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Confirmar recebimento do acesso',
      description: 'Verificar se a cliente conseguiu entrar na área de membros.',
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      status: 'OPEN',
      assignedUserName: 'Jhonattan'
    },
    {
      id: 'task-2',
      title: 'Enviar mensagem de boas-vindas',
      description: 'Usar template de compra aprovada com CTA para próximo passo.',
      status: 'DONE',
      assignedUserName: 'Equipe Comercial'
    }
  ],
  templates: [
    {
      id: 'tpl-1',
      title: 'Pix pendente',
      category: 'PIX_PENDING',
      content:
        'Vi que seu pagamento ficou pendente. Se quiser, posso te mandar o link novamente para concluir agora.'
    },
    {
      id: 'tpl-2',
      title: 'Cartão recusado',
      category: 'CREDIT_CARD_DECLINED',
      content:
        'Seu pagamento no cartão não foi concluído. Se quiser, posso te enviar a opção por Pix agora.'
    },
    {
      id: 'tpl-3',
      title: 'Compra aprovada',
      category: 'PURCHASE_APPROVED',
      content:
        'Pagamento aprovado com sucesso. Agora vou te passar o próximo passo para acessar tudo.'
    },
    {
      id: 'tpl-4',
      title: 'Follow-up geral',
      category: 'GENERAL',
      content:
        'Passei aqui para te ajudar a concluir isso da forma mais rápida. Se quiser, posso te orientar agora.'
    }
  ]
};

export const demoBoardLeads: DemoBoardLead[] = [
  { id: 'board-1', name: 'Amor Roxo', phone: '5511998765432', stageId: 'stage-checkout' },
  { id: 'board-2', name: 'Jennifer Mattos', phone: '5511987650101', stageId: 'stage-new' },
  { id: 'board-3', name: 'Alex Faria', phone: '5511976542020', stageId: 'stage-new' },
  { id: 'board-4', name: 'Anne Galante', phone: '5511912340001', stageId: 'stage-service' },
  { id: 'board-5', name: 'Edmar Cintra', phone: '5511981610503', stageId: 'stage-pix' },
  { id: 'board-6', name: 'M.I. Tech', phone: '5511977778888', stageId: 'stage-declined' },
  { id: 'board-7', name: 'Comprador Exemplo', phone: '5511966661111', stageId: 'stage-approved' }
];
