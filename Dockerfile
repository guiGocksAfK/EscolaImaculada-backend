# Imagem multi-arquitetura: a VM da Oracle (Ampere A1) é ARM64.
# Node 24 (npm 11) de propósito: com o npm 10 do Node 22 o `npm ci` recusa o
# package-lock.json deste repo ("Missing: typescript@5.9.3 from lock file"),
# porque as duas versões do npm resolvem as peer dependencies de forma diferente.
FROM node:24-slim AS build

WORKDIR /app

# openssl: exigido pelo Prisma.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# O postinstall roda `prisma generate`, então o schema precisa existir antes.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

# Tira as dependências de desenvolvimento da árvore que vai para a imagem
# final (typescript, vitest, @nestjs/cli, @nestjs/mau e as CVEs que vêm
# junto delas). O CLI do Prisma continua, porque o start:prod roda
# `prisma migrate deploy` — e com ele ficam mysql2 e deepmerge-ts, que são
# dependências dele e nunca chegam a ser carregadas (o datasource é Postgres).
RUN npm prune --omit=dev

FROM node:24-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# node_modules já vem podado (npm prune --omit=dev no estágio de build). O
# `start:prod` chama o CLI do Prisma, que lê o prisma7.config.ts — por isso
# `prisma` e `dotenv` são dependências de produção de verdade, não de dev.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json prisma7.config.ts ./
COPY prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

# Sem isto o processo roda como root: a imagem node já traz o usuário `node`,
# sem privilégio, e a API não escreve nada no disco. Vem depois dos COPY, que
# precisam de root para escrever em /app.
USER node

# Aplica as migrations pendentes e sobe a API.
CMD ["npm", "run", "start:prod"]
