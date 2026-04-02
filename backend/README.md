# Backend

Backend NestJS com Prisma e PostgreSQL para autenticação da extensão.

## Setup

1. Copie o ambiente:

```bash
cp .env.example .env
```

2. Suba o banco na raiz do projeto:

```bash
docker compose up -d
```

3. Instale dependências:

```bash
npm install
```

4. Gere o Prisma Client:

```bash
npm run prisma:generate
```

5. Rode a migration:

```bash
npm run prisma:migrate -- --name init
```

6. Rode o seed:

```bash
npm run seed
```

7. Inicie a API:

```bash
npm run start:dev
```

## Login seeded

- Email: `jhonattan.cintra@gmail.com`
- Senha: `123277`

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
