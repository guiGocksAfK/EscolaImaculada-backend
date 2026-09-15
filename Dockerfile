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

FROM node:24-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Carrega as dependências completas (não só as de produção) de propósito: o
# `start:prod` chama o CLI do Prisma, que lê o prisma7.config.ts — e esse
# arquivo importa `dotenv`, que hoje só existe como dependência indireta.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json prisma7.config.ts ./
COPY prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

# Aplica as migrations pendentes e sobe a API.
CMD ["npm", "run", "start:prod"]
