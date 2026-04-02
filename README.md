# CRM John

Projeto em estrutura simples com:

- `backend/`: API NestJS + Prisma + PostgreSQL
- `extension/`: extensão Chrome Manifest V3 com React + TypeScript + Tailwind

## O que já está modelado

- autenticação e workspace
- leads, pipeline e estágios
- notas, tarefas e timeline
- templates de mensagem
- pedidos e eventos de checkout
- webhook base para checkout:
  - `POST /webhooks/checkouts/:provider/:token`

## Subir o banco

```bash
docker compose up -d
```

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
npm run start:dev
```

Login seed:

- Email: `jhonattan.cintra@gmail.com`
- Senha: `123277`
- Checkout token seed: `seed-checkout-token`

Endpoints principais já expostos:

- `POST /auth/login`
- `GET /auth/me`
- `GET /leads/by-phone/:phone`
- `GET /leads/:id`
- `GET /leads/:id/timeline`
- `GET /leads/:id/notes`
- `POST /leads/:id/notes`
- `GET /leads/:id/tasks`
- `POST /leads/:id/tasks`
- `PATCH /leads/:id/stage`
- `PATCH /tasks/:id/status`
- `GET /pipelines/default`
- `GET /templates`
- `POST /webhooks/checkouts/:provider/:token`

## Extensão

```bash
cd extension
npm install
npm run build
```

Depois abra `chrome://extensions`, ative `Developer mode` e carregue a pasta:

[`/Users/johncintra/Projects/CRM/CRM-John/extension/dist`](/Users/johncintra/Projects/CRM/CRM-John/extension/dist)
