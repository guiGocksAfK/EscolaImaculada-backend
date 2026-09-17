#!/usr/bin/env bash
#
# Backup diário do banco (Neon) — dump comprimido, cifrado e copiado para fora
# da VM. Chamado pelo timer do systemd (escola-backup.timer); dá para rodar na
# mão também: bash deploy/backup.sh
#
# Precisa no PATH: docker, age, rclone, curl.
# Configuração: deploy/.env (as chaves BACKUP_* e B2_*; ver .env.example).
#
# Três garantias que o script se impõe:
#   1. O arquivo só recebe o nome definitivo quando o dump termina inteiro —
#      backup truncado nunca é confundido com backup bom.
#   2. Nenhum segredo aparece na linha de comando (visível por outros usuários
#      da VM via `ps`): a URL do banco entra no container por variável de
#      ambiente herdada, não como argumento.
#   3. Se qualquer etapa falhar, o ping de sucesso não é enviado — e o
#      dead man's switch avisa. Backup que quebra calado é o pior tipo.

set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
[ -f "$AQUI/.env" ] && set -a && . "$AQUI/.env" && set +a

: "${DATABASE_URL_DIRETA:?defina DATABASE_URL_DIRETA no deploy/.env (a URL SEM -pooler)}"
: "${BACKUP_AGE_PUBKEY:?defina BACKUP_AGE_PUBKEY no deploy/.env (a chave publica age1...)}"

# `?schema=public` é parâmetro do Prisma, não do libpq: o pg_dump recusa a URL
# INTEIRA por causa dele ("invalid URI query parameter: schema"). Como é comum
# copiar a DATABASE_URL do Prisma pra cá, o script tira só esse parâmetro e
# preserva o resto — sslmode=require, em especial, precisa sobreviver.
export URL_DUMP="$(printf '%s' "$DATABASE_URL_DIRETA" | sed -E 's/([?&])schema=[^&]*/\1/g; s/\?&/?/g; s/&&/\&/g; s/[?&]$//')"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/escola}"
BACKUP_RETENCAO_DIAS="${BACKUP_RETENCAO_DIAS:-14}"
BACKUP_PG_IMAGE="${BACKUP_PG_IMAGE:-postgres:17-alpine}"
BACKUP_TAMANHO_MINIMO="${BACKUP_TAMANHO_MINIMO:-2048}" # bytes

log() { printf '[backup] %s\n' "$*"; }

avisar_falha() {
  log "FALHOU"
  [ -n "${HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 --retry 2 "$HEALTHCHECK_URL/fail" -o /dev/null || true
}
trap avisar_falha ERR

for cmd in docker age; do
  command -v "$cmd" >/dev/null || { log "faltando: $cmd"; exit 1; }
done

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

CARIMBO="$(date +%Y-%m-%d-%H%M)"
ALVO="$BACKUP_DIR/escola-$CARIMBO.sql.gz.age"
PARCIAL="$ALVO.parcial"

log "gerando dump ($BACKUP_PG_IMAGE)"

# `-e NOME` (sem =valor) manda o docker herdar a variável do ambiente deste
# script: o valor não passa pelos argumentos, então não vaza no `ps`. O mesmo
# vale lá dentro, onde o pg_dump lê a variável em vez de receber a URL.
#
# --no-owner/--no-privileges: o dump precisa restaurar em qualquer banco
# (o Postgres local de teste), não só num que tenha os mesmos papéis do Neon.
docker run --rm -i -e URL_DUMP "$BACKUP_PG_IMAGE" sh -c 'pg_dump --no-owner --no-privileges "$URL_DUMP"' | gzip -9 | age -r "$BACKUP_AGE_PUBKEY" -o "$PARCIAL"

TAMANHO="$(stat -c %s "$PARCIAL")"
if [ "$TAMANHO" -lt "$BACKUP_TAMANHO_MINIMO" ]; then
  log "dump suspeito: $TAMANHO bytes (< $BACKUP_TAMANHO_MINIMO). Abortando."
  rm -f "$PARCIAL"
  exit 1
fi

mv "$PARCIAL" "$ALVO"
chmod 600 "$ALVO"
log "local: $ALVO ($TAMANHO bytes)"

# --- cópia para fora da VM ---------------------------------------------------
# Configuração do rclone por variável de ambiente: sem `rclone config`, sem
# arquivo de credencial a mais no disco. Os nomes RCLONE_CONFIG_B2_* definem
# um remote chamado "b2" na hora.
if [ -n "${B2_BUCKET:-}" ]; then
  command -v rclone >/dev/null || { log "faltando: rclone"; exit 1; }
  : "${B2_KEY_ID:?defina B2_KEY_ID no deploy/.env}"
  : "${B2_APP_KEY:?defina B2_APP_KEY no deploy/.env}"

  export RCLONE_CONFIG_B2_TYPE=b2
  export RCLONE_CONFIG_B2_ACCOUNT="$B2_KEY_ID"
  export RCLONE_CONFIG_B2_KEY="$B2_APP_KEY"

  log "enviando para b2:$B2_BUCKET"
  rclone copy "$ALVO" "b2:$B2_BUCKET/" --no-traverse --retries 3
  log "enviado"
else
  log "B2_BUCKET vazio — cópia externa desativada (backup só na VM)"
fi

# --- retenção local ----------------------------------------------------------
# No B2 quem manda na retenção é o lifecycle do bucket, não este script: a
# chave da VM não deve conseguir apagar nada de lá.
APAGADOS="$(find "$BACKUP_DIR" -name 'escola-*.sql.gz.age' -mtime "+$BACKUP_RETENCAO_DIAS" -print -delete | wc -l)"
log "retenção local: $APAGADOS arquivo(s) com mais de $BACKUP_RETENCAO_DIAS dias removido(s)"

[ -n "${HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 --retry 2 "$HEALTHCHECK_URL" -o /dev/null || true

log "OK"
