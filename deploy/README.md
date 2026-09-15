# Deploy na Oracle Cloud (VM `guigo-cloud`)

API NestJS em Docker na mesma VM ARM do MyRank, atrás do **Caddy compartilhado**
(`~/infra`), que cuida do HTTPS. O banco fica no **Neon (São Paulo)** e o front
continua na **Vercel**.

```
Vercel (front Angular) ──HTTPS──▶ Caddy :443 ──▶ escola-api :3000 ──▶ Neon
                                  └─────── VM Oracle (rede `web`) ───┘
```

## Pré-requisitos na VM (já feitos, se o MyRank está no ar)

- Docker e portas 80/443 liberadas (`bash deploy/setup-vm.sh` do MyRank).
- Rede compartilhada: `docker network create web`.
- Caddy de pé: `cd ~/infra && docker compose up -d`.
- Domínio apontando pro IP da VM: `escolaimaculada.duckdns.org`.

## Subir

```bash
ssh -i ~/.ssh/guigo-cloud.key ubuntu@IP_DA_VM

git clone -b deploy-oracle https://github.com/guiGocksAfK/EscolaImaculada-backend.git
cd EscolaImaculada-backend/deploy
cp .env.example .env
nano .env                   # DATABASE_URL (Neon SP), JWT_SECRET, CORS_ORIGIN...
docker compose up -d --build
docker compose logs -f api  # o start:prod roda as migrations antes de subir
```

No `~/infra/Caddyfile` tem que existir o bloco:

```
escolaimaculada.duckdns.org {
	encode zstd gzip
	reverse_proxy escola-api:3000
}
```

Depois de mexer no Caddyfile: `cd ~/infra && docker compose restart caddy`.

## Virar a chave

1. **Vercel** (front da escola) → Settings → Environment Variables: aponte a URL
   da API pra `https://escolaimaculada.duckdns.org` → **Redeploy**.
2. Confirme que o domínio do front está no `CORS_ORIGIN` do `.env`.
3. Teste login da diretora e de uma professora, chamada, conteúdo e relatórios.
4. Deu certo → **suspenda** o serviço no Render (não apague por uns dias).

## Atualizar depois

```bash
cd ~/EscolaImaculada-backend && git pull && cd deploy && docker compose up -d --build && docker image prune -f
```

## Comandos úteis

| O quê | Comando |
|---|---|
| Ver logs | `docker compose logs -f api` |
| Reiniciar | `docker compose restart api` |
| Status | `docker compose ps` |
| Memória/CPU de tudo | `docker stats` |
