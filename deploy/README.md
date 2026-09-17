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

## Backup e restauração

Três camadas, cada uma cobrindo a falha da anterior:

| Camada | O que cobre | O que não cobre |
|---|---|---|
| PITR do Neon | erro recente ("apaguei agora") | perder o acesso à conta do Neon |
| Dump diário na VM | o banco sumir, migration ruim, exclusão descoberta semanas depois | a VM sumir junto |
| Cópia no Backblaze B2 | a VM sumir (free tier reclamado, conta suspensa) | perder a chave privada do `age` |

O dump é cifrado **antes** de sair da VM: lá fica só a chave pública do `age`,
então nem invadindo o servidor se lê o conteúdo dos backups. No B2, o Object
Lock (governance, 30 dias) impede que qualquer chave — inclusive a da VM, se
vazar — apague o histórico antes do prazo.

### Instalar na VM (uma vez)

Gere o par de chaves **na sua máquina**, não na VM (só a pública sobe):

```bash
age-keygen -o chave-backup.txt
```

A linha `# public key: age1...` é o que vai no `.env`. O arquivo inteiro
(chave privada) vai para o gerenciador de senhas, com uma segunda cópia em
outro lugar. **Sem ela não existe restauração** — é o único jeito de este
desenho falhar de forma irrecuperável.

Na VM:

```bash
sudo apt update && sudo apt install -y age rclone
cd ~/EscolaImaculada-backend/deploy
nano .env    # DATABASE_URL_DIRETA, BACKUP_AGE_PUBKEY, B2_*, HEALTHCHECK_URL
sudo install -d -o ubuntu -g ubuntu -m 700 /var/backups/escola
sudo cp escola-backup.service escola-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now escola-backup.timer
```

Rode uma vez na mão para ver funcionando:

```bash
sudo systemctl start escola-backup.service && journalctl -u escola-backup.service -n 30 --no-pager
```

E confira o próximo disparo:

```bash
systemctl list-timers escola-backup.timer
```

### Restaurar — e por que testar isso uma vez

Enquanto a restauração não for executada de verdade, o que existe é um monte
de arquivo, não um backup. Faça este roteiro uma vez agora e repita quando
algo grande mudar no schema.

1. Baixe um dump (do `/var/backups/escola` na VM ou do bucket no B2).
2. Decifre e descomprima, com a chave privada:

   ```bash
   age -d -i chave-backup.txt escola-AAAA-MM-DD-HHMM.sql.gz.age | gunzip > escola.sql
   ```

3. Suba o Postgres local (`docker-compose.yml` da raiz do repositório) e crie
   um banco limpo só para o teste:

   ```bash
   docker compose up -d
   docker exec -i escola-imaculada-db psql -U escola -d postgres -c 'CREATE DATABASE restore_teste'
   ```

4. Restaure:

   ```bash
   docker exec -i escola-imaculada-db psql -U escola -d restore_teste < escola.sql
   ```

5. Aponte a API para ele e **faça login de verdade** — é isso que prova que o
   dump presta:

   ```bash
   DATABASE_URL="postgresql://escola:escola@localhost:5432/restore_teste?schema=public" npm run start:dev
   ```

6. Confira uma turma, uma chamada e um relatório. Depois anote a data do teste
   aqui: **última restauração testada em 17/09/2026** (dump de 17/09 decifrado com a
   chave `age`, restaurado num Postgres 18 limpo: 10 tabelas, contagens iguais
   às do dump — 15 alunos, 16 registros de chamada, 3 usuários)..

### Cuidados

- O `.sql.gz.age` é o arquivo mais sensível do projeto (CPF, endereço e
  filiação de crianças). Não o deixe decifrado em pasta compartilhada, e apague
  o `escola.sql` do teste quando terminar.
- A retenção do B2 é do lifecycle do bucket, não do script: a chave da VM não
  deve conseguir apagar nada de lá.
- Retenção local: 14 dias (`BACKUP_RETENCAO_DIAS`).
- Pedido de exclusão de dados (LGPD) não some das cópias na hora — o Object
  Lock segura por até 30 dias. É limitado e defensável, mas é bom saber antes.
