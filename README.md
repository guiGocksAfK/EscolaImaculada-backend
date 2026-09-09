# EscolaImaculada — Backend

API (NestJS + Prisma + PostgreSQL) do sistema de registro de classe da
Escola Imaculada. Ficha de segurança em vigor e pendências: [SECURITY.md](./SECURITY.md).

## Requisitos

- Node.js ≥ 20
- PostgreSQL (local via `docker-compose.yml`, ou um serviço gerenciado)

## Rodando localmente

```bash
cp .env.example .env        # ajuste DATABASE_URL/JWT_SECRET se necessário
docker compose up -d        # sobe o Postgres local (usuário/senha "escola")
npm install                 # já roda "prisma generate" (postinstall)
npx prisma migrate dev      # aplica as migrations no banco local
npm run start:dev           # API em http://localhost:3000
```

Popular com dados de demonstração (**nunca em produção** — apaga tudo antes de recriar):

```bash
npm run seed
```

## Scripts principais

| Script | O que faz |
|---|---|
| `npm run start:dev` | API com watch/reload, para desenvolvimento. |
| `npm run build` | Compila para `dist/`. |
| `npm run start:prod` | Roda `prisma migrate deploy` e sobe `dist/main` — é o comando de produção. |
| `npm run test` / `test:e2e` | Testes unitários / e2e (vitest). |
| `npm run test:smoke` | Smoke test via `test/smoke.sh` (sobe a API real e bate nos endpoints). |

## Variáveis de ambiente

Ver [.env.example](./.env.example) para a lista completa e comentada. As que
**mudam** entre ambiente local e produção:

| Variável | Local | Produção |
|---|---|---|
| `DATABASE_URL` | Postgres do `docker-compose.yml` | string do banco gerenciado (com `sslmode=require`) |
| `JWT_SECRET` | qualquer valor ≥32 chars | segredo novo e forte (`openssl rand -base64 48`) — **nunca reaproveitar o de dev** |
| `CORS_ORIGIN` | `http://localhost:4200` | domínio(s) real(is) do frontend |
| `NODE_ENV` | (vazio) | `production` — ativa validações extras no boot (recusa subir com `CORS_ORIGIN`/`DATABASE_URL` de localhost) |
| `TRUST_PROXY` | (vazio) | `1` — a API fica atrás de proxy/load balancer da plataforma |

Sem essas variáveis certas em produção, o app **não sobe** (ver
[env.validation.ts](./src/common/env.validation.ts)) — é proposital, pra
falhar no deploy em vez de rodar mal configurado.

## Deploy (Render + Neon)

1. **Neon** (Postgres): crie um projeto, copie a *connection string* com
   sufixo `-pooler` (pooled) e confirme que já tem `sslmode=require` (o Neon
   inclui por padrão).
2. **Render**: novo Web Service apontando para este repositório.
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Env vars: `DATABASE_URL` (a do Neon), `JWT_SECRET`, `JWT_EXPIRES_IN=8h`,
     `CORS_ORIGIN` (domínio do frontend no Vercel), `NODE_ENV=production`,
     `TRUST_PROXY=1`. `PORT` é definido automaticamente pelo Render.
3. Primeiro deploy já aplica as migrations (`start:prod` roda
   `prisma migrate deploy` antes de subir o servidor).

No plano free do Render a API "dorme" após períodos sem tráfego — a primeira
requisição depois disso demora mais (cold start).
