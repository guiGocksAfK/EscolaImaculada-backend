#!/usr/bin/env bash
#
# Smoke test da API — exercita todos os módulos de ponta a ponta contra um
# backend rodando (padrão http://localhost:3000).
#
#   Uso:   bash test/smoke.sh
#          BASE_URL=http://localhost:3000 bash test/smoke.sh
#
# Cada execução cria 2 escolas novas (CPFs únicos por timestamp), então pode
# rodar quantas vezes quiser sem resetar o banco. Sai com código != 0 se
# qualquer verificação falhar.

set -u

BASE="${BASE_URL:-http://localhost:3000}"
# base de 9 dígitos p/ montar CPFs únicos de 11 dígitos (base + 2 dígitos)
TS="$(date +%s)"
TS="${TS: -9}"
cpf() { printf '%s%02d' "$TS" "$1"; }
PASS=0
FAIL=0

if [ -t 1 ]; then
  G=$'\e[32m'; RED=$'\e[31m'; Y=$'\e[33m'; DIM=$'\e[2m'; Z=$'\e[0m'
else
  G=""; RED=""; Y=""; DIM=""; Z=""
fi

# --- helpers ---------------------------------------------------------------

# json <campo-node>  — lê JSON do stdin e imprime a expressão (ex: .accessToken)
json() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);let v=o$1;console.log(v==null?'':typeof v==='object'?JSON.stringify(v):v)}catch{console.log('')}})"; }

# req <METHOD> <path> [json-body] [bearer-token]
# imprime:  <body em 1 linha>\n<http_code>
req() {
  local method="$1" path="$2" body="${3:-}" tok="${4:-}"
  local args=(-s -w $'\n%{http_code}' -X "$method" "$BASE$path")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  [ -n "$tok" ] && args+=(-H "Authorization: Bearer $tok")
  curl "${args[@]}"
}

code_of() { printf '%s' "$1" | tail -n1; }
body_of() { printf '%s' "$1" | sed '$d'; }

# check <label> <esperado> <obtido>
check() {
  if [ "$2" = "$3" ]; then
    PASS=$((PASS + 1)); printf '  %s✓%s %s\n' "$G" "$Z" "$1"
  else
    FAIL=$((FAIL + 1)); printf '  %s✗%s %s %s(esperado %s, obtido %s)%s\n' "$RED" "$Z" "$1" "$DIM" "$2" "$3" "$Z"
  fi
}

section() { printf '\n%s== %s ==%s\n' "$Y" "$1" "$Z"; }

# --- 0. servidor no ar ---------------------------------------------------

section "Servidor"
PING="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/auth/login" -X POST -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo 000)"
if [ "$PING" = "000" ]; then
  printf '%s✗ backend não respondeu em %s%s\n' "$RED" "$BASE" "$Z"
  printf '   Suba com: docker compose up -d && npm run start:dev\n'
  exit 1
fi
check "backend respondendo em $BASE" "400" "$PING"

# --- 1. Auth -----------------------------------------------------------------

section "Auth / cadastro"

CPF_DIR="$(cpf 1)"
R1="$(req POST /auth/cadastro-inicial "{\"escola\":{\"nome\":\"Escola Smoke $TS\",\"endereco\":\"Rua Teste, 1\"},\"diretora\":{\"nome\":\"Diretora Smoke\",\"cpf\":\"$CPF_DIR\",\"dataNascimento\":\"1980-01-01\",\"senha\":\"senha123\"}}")"
check "cadastro-inicial cria escola+diretora" "201" "$(code_of "$R1")"
TOK_DIR="$(body_of "$R1" | json .accessToken)"
[ -n "$TOK_DIR" ] && check "cadastro-inicial retorna accessToken" "sim" "sim" || check "cadastro-inicial retorna accessToken" "sim" "não"

R2="$(req POST /auth/cadastro-inicial "{\"escola\":{\"nome\":\"Escola Repetida\",\"endereco\":\"Rua Qualquer, 10\"},\"diretora\":{\"nome\":\"Outra Diretora\",\"cpf\":\"$CPF_DIR\",\"dataNascimento\":\"1980-01-01\",\"senha\":\"senha123\"}}")"
check "cadastro com CPF repetido → 409" "409" "$(code_of "$R2")"

check "login correto → 200" "200" "$(code_of "$(req POST /auth/login "{\"cpf\":\"$CPF_DIR\",\"senha\":\"senha123\"}")")"
check "login senha errada → 401" "401" "$(code_of "$(req POST /auth/login "{\"cpf\":\"$CPF_DIR\",\"senha\":\"errada\"}")")"
check "login CPF inexistente → 401" "401" "$(code_of "$(req POST /auth/login "{\"cpf\":\"00000000000\",\"senha\":\"seja\"}")")"
check "validação: body vazio → 400" "400" "$(code_of "$(req POST /auth/login '{}')")"
check "rota protegida sem token → 401" "401" "$(code_of "$(req GET /escola)")"

# --- 2. Escola -------------------------------------------------------------

section "Escola"
R="$(req GET /escola "" "$TOK_DIR")"
check "GET /escola → 200" "200" "$(code_of "$R")"
check "GET /escola traz o nome certo" "Escola Smoke $TS" "$(body_of "$R" | json .nome)"

R="$(req PUT /escola "{\"nome\":\"Escola Smoke $TS\",\"endereco\":\"Rua Nova, 99\"}" "$TOK_DIR")"
check "PUT /escola (diretora) → 200" "200" "$(code_of "$R")"
check "PUT /escola atualiza endereço" "Rua Nova, 99" "$(body_of "$R" | json .endereco)"

# --- 3. Professoras ------------------------------------------------------

section "Professoras"
CPF_P1="$(cpf 2)"
CPF_P2="$(cpf 3)"
R="$(req POST /professoras "{\"nome\":\"Prof Um\",\"cpf\":\"$CPF_P1\",\"dataNascimento\":\"1990-05-05\",\"senha\":\"prof123\"}" "$TOK_DIR")"
check "POST /professoras → 201" "201" "$(code_of "$R")"
PROF1_ID="$(body_of "$R" | json .id)"
check "professora nasce com totalTurmas 0" "0" "$(body_of "$R" | json .totalTurmas)"

req POST /professoras "{\"nome\":\"Prof Dois\",\"cpf\":\"$CPF_P2\",\"dataNascimento\":\"1991-06-06\",\"senha\":\"prof123\"}" "$TOK_DIR" >/dev/null

R="$(req POST /professoras "{\"nome\":\"Dup\",\"cpf\":\"$CPF_P1\",\"dataNascimento\":\"1990-05-05\",\"senha\":\"prof123\"}" "$TOK_DIR")"
check "POST /professoras CPF repetido → 409" "409" "$(code_of "$R")"

R="$(req GET /professoras "" "$TOK_DIR")"
check "GET /professoras lista as 2" "2" "$(body_of "$R" | json .length)"

R="$(req PUT "/professoras/$PROF1_ID" "{\"nome\":\"Prof Um Editada\",\"cpf\":\"$CPF_P1\",\"dataNascimento\":\"1990-05-05\"}" "$TOK_DIR")"
check "PUT /professoras/:id (senha em branco) → 200" "200" "$(code_of "$R")"
check "PUT /professoras/:id salva nome" "Prof Um Editada" "$(body_of "$R" | json .nome)"

# login como professora 1
TOK_P1="$(body_of "$(req POST /auth/login "{\"cpf\":\"$CPF_P1\",\"senha\":\"prof123\"}")" | json .accessToken)"
[ -n "$TOK_P1" ] && check "professora consegue logar" "sim" "sim" || check "professora consegue logar" "sim" "não"

# --- 4. Turmas -----------------------------------------------------------

section "Turmas"
R="$(req POST /turmas "{\"nome\":\"Infantil 5 - Tarde\",\"periodo\":\"TARDE\",\"anoLetivo\":2026,\"professoraId\":\"$PROF1_ID\"}" "$TOK_DIR")"
check "POST /turmas (diretora) → 201" "201" "$(code_of "$R")"
TURMA_ID="$(body_of "$R" | json .id)"
check "turma vem com professora embutida" "Prof Um Editada" "$(body_of "$R" | json .professora.nome)"

R="$(req POST /turmas "{\"nome\":\"Manha\",\"periodo\":\"MANHA\",\"anoLetivo\":2026,\"professoraId\":\"$PROF1_ID\"}" "$TOK_P1")"
check "POST /turmas como professora → 403" "403" "$(code_of "$R")"

R="$(req POST /turmas "{\"nome\":\"Ruim\",\"periodo\":\"XPTO\",\"anoLetivo\":2026,\"professoraId\":\"$PROF1_ID\"}" "$TOK_DIR")"
check "POST /turmas período inválido → 400" "400" "$(code_of "$R")"

check "GET /turmas diretora vê 1" "1" "$(body_of "$(req GET /turmas "" "$TOK_DIR")" | json .length)"
check "GET /turmas professora 1 vê a dela" "1" "$(body_of "$(req GET /turmas "" "$TOK_P1")" | json .length)"
TOK_P2="$(body_of "$(req POST /auth/login "{\"cpf\":\"$CPF_P2\",\"senha\":\"prof123\"}")" | json .accessToken)"
check "GET /turmas professora 2 vê 0" "0" "$(body_of "$(req GET /turmas "" "$TOK_P2")" | json .length)"

R="$(req DELETE "/professoras/$PROF1_ID" "" "$TOK_DIR")"
check "DELETE professora com turma → 409" "409" "$(code_of "$R")"

# --- 5. Alunos ---------------------------------------------------------------

section "Alunos"
R="$(req POST /alunos "{\"nome\":\"Aluno Teste\",\"cpf\":\"123\",\"dataNascimento\":\"2020-03-03\",\"nomePai\":\"Pai\",\"nomeMae\":\"Mae\",\"localNascimento\":\"Curitiba\",\"endereco\":\"Rua Z\",\"turmaId\":\"$TURMA_ID\"}" "$TOK_DIR")"
check "POST /alunos → 201" "201" "$(code_of "$R")"
ALUNO_ID="$(body_of "$R" | json .id)"
check "aluno nasce ATIVO" "ATIVO" "$(body_of "$R" | json .status)"

check "GET /alunos?turmaId lista 1" "1" "$(body_of "$(req GET "/alunos?turmaId=$TURMA_ID" "" "$TOK_DIR")" | json .length)"
check "GET /alunos?status=TRANSFERIDO lista 0" "0" "$(body_of "$(req GET "/alunos?status=TRANSFERIDO" "" "$TOK_DIR")" | json .length)"

R="$(req PATCH "/alunos/$ALUNO_ID/status" "{\"status\":\"TRANSFERIDO\"}" "$TOK_DIR")"
check "PATCH /alunos/:id/status → 200" "200" "$(code_of "$R")"
check "status virou TRANSFERIDO" "TRANSFERIDO" "$(body_of "$R" | json .status)"
req PATCH "/alunos/$ALUNO_ID/status" '{"status":"ATIVO"}' "$TOK_DIR" >/dev/null

R="$(req PUT "/alunos/$ALUNO_ID" "{\"nome\":\"Aluno Editado\",\"cpf\":\"123\",\"dataNascimento\":\"2020-03-03\",\"nomePai\":\"Pai\",\"nomeMae\":\"Mae\",\"localNascimento\":\"Curitiba\",\"endereco\":\"Rua Z\",\"turmaId\":\"$TURMA_ID\",\"status\":\"ATIVO\"}" "$TOK_DIR")"
check "PUT /alunos/:id → 200" "200" "$(code_of "$R")"

# --- 6. Chamada ---------------------------------------------------------

section "Chamada"
DIA="2026-03-10"
R="$(req PUT /chamada "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"registros\":[{\"alunoId\":\"$ALUNO_ID\",\"status\":\"F\"}]}" "$TOK_DIR")"
check "PUT /chamada (upsert) → 200" "200" "$(code_of "$R")"

R="$(req GET "/chamada?turmaId=$TURMA_ID&data=$DIA" "" "$TOK_DIR")"
check "GET /chamada do dia traz 1 registro" "1" "$(body_of "$R" | json .registros.length)"
check "status do registro é F" "F" "$(body_of "$R" | json '.registros[0].status')"

# upsert de novo, mudando pra C — não deve duplicar
req PUT /chamada "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"registros\":[{\"alunoId\":\"$ALUNO_ID\",\"status\":\"C\"}]}" "$TOK_DIR" >/dev/null
R="$(req GET "/chamada?turmaId=$TURMA_ID&data=$DIA" "" "$TOK_DIR")"
check "upsert não duplica (ainda 1)" "1" "$(body_of "$R" | json .registros.length)"
check "status atualizado pra C" "C" "$(body_of "$R" | json '.registros[0].status')"

R="$(req GET "/chamada/mensal?turmaId=$TURMA_ID&ano=2026&mes=3" "" "$TOK_DIR")"
check "GET /chamada/mensal → 200" "200" "$(code_of "$R")"
check "mensal lista o dia lançado" "$DIA" "$(body_of "$R" | json '.dias[0]')"
check "mensal traz 1 linha (1 aluno ativo)" "1" "$(body_of "$R" | json .linhas.length)"

# --- 7. Conteúdo -------------------------------------------------------------

section "Conteúdo"
R="$(req POST /conteudo "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"conteudo\":\"Vogais A E I O U\"}" "$TOK_DIR")"
check "POST /conteudo → 201" "201" "$(code_of "$R")"
CONT_ID="$(body_of "$R" | json .id)"
check "GET /conteudo lista 1" "1" "$(body_of "$(req GET "/conteudo?turmaId=$TURMA_ID" "" "$TOK_DIR")" | json .length)"
check "PUT /conteudo/:id → 200" "200" "$(code_of "$(req PUT "/conteudo/$CONT_ID" "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"conteudo\":\"Vogais e numeros\"}" "$TOK_DIR")")"
check "DELETE /conteudo/:id → 204" "204" "$(code_of "$(req DELETE "/conteudo/$CONT_ID" "" "$TOK_DIR")")"

# --- 8. Avaliações -----------------------------------------------------------

section "Avaliações"
R="$(req POST /avaliacoes "{\"alunoId\":\"$ALUNO_ID\",\"turmaId\":\"$TURMA_ID\",\"texto\":\"Otimo desenvolvimento\",\"referencia\":\"1o semestre 2026\"}" "$TOK_DIR")"
check "POST /avaliacoes → 201" "201" "$(code_of "$R")"
AVAL_ID="$(body_of "$R" | json .id)"
check "avaliação traz aluno e turma" "Aluno Editado" "$(body_of "$R" | json .aluno.nome)"
check "GET /avaliacoes?alunoId lista 1" "1" "$(body_of "$(req GET "/avaliacoes?alunoId=$ALUNO_ID" "" "$TOK_DIR")" | json .length)"
check "PUT /avaliacoes/:id → 200" "200" "$(code_of "$(req PUT "/avaliacoes/$AVAL_ID" "{\"alunoId\":\"$ALUNO_ID\",\"turmaId\":\"$TURMA_ID\",\"texto\":\"Evoluiu bem\",\"referencia\":\"1o semestre 2026\"}" "$TOK_DIR")")"

# --- 9. Faltas justificadas -----------------------------------------------

section "Faltas justificadas"
R="$(req POST /faltas-justificadas "{\"alunoId\":\"$ALUNO_ID\",\"data\":\"2026-03-11\",\"motivo\":\"Atestado medico\"}" "$TOK_DIR")"
check "POST /faltas-justificadas → 201" "201" "$(code_of "$R")"
FALTA_ID="$(body_of "$R" | json .id)"
check "GET /faltas-justificadas?turmaId lista 1" "1" "$(body_of "$(req GET "/faltas-justificadas?turmaId=$TURMA_ID" "" "$TOK_DIR")" | json .length)"
check "DELETE /faltas-justificadas/:id → 204" "204" "$(code_of "$(req DELETE "/faltas-justificadas/$FALTA_ID" "" "$TOK_DIR")")"

# --- 10. Relatórios ----------------------------------------------------------

section "Relatórios"
# recria uma falta justificada pra contar no resumo
req POST /faltas-justificadas "{\"alunoId\":\"$ALUNO_ID\",\"data\":\"2026-04-01\",\"motivo\":\"Viagem\"}" "$TOK_DIR" >/dev/null
R="$(req GET "/relatorios/resumo?turmaId=$TURMA_ID&ano=2026" "" "$TOK_DIR")"
check "GET /relatorios/resumo → 200" "200" "$(code_of "$R")"
check "resumo: 1 dia lançado" "1" "$(body_of "$R" | json .diasLancados)"
check "resumo: 1 presença (C)" "1" "$(body_of "$R" | json '.linhas[0].presencas')"
check "resumo: 0 faltas (F)" "0" "$(body_of "$R" | json '.linhas[0].faltas')"
check "resumo: 1 falta justificada" "1" "$(body_of "$R" | json '.linhas[0].faltasJustificadas')"
check "resumo: 1 avaliação" "1" "$(body_of "$R" | json '.linhas[0].avaliacoes.length')"

# --- 11. Isolamento multi-escola --------------------------------------------

section "Isolamento entre escolas"
CPF_DIR2="$(cpf 9)"
R2ESC="$(req POST /auth/cadastro-inicial "{\"escola\":{\"nome\":\"Escola B $TS\",\"endereco\":\"Outra rua, 2\"},\"diretora\":{\"nome\":\"Diretora B\",\"cpf\":\"$CPF_DIR2\",\"dataNascimento\":\"1982-02-02\",\"senha\":\"senha123\"}}")"
TOK_DIR2="$(body_of "$R2ESC" | json .accessToken)"
check "2ª escola criada" "201" "$(code_of "$R2ESC")"
check "diretora B vê 0 turmas" "0" "$(body_of "$(req GET /turmas "" "$TOK_DIR2")" | json .length)"
check "diretora B vê 0 alunos" "0" "$(body_of "$(req GET /alunos "" "$TOK_DIR2")" | json .length)"
check "diretora B vê 0 professoras" "0" "$(body_of "$(req GET /professoras "" "$TOK_DIR2")" | json .length)"
check "diretora B vê a própria escola (nome B)" "Escola B $TS" "$(body_of "$(req GET /escola "" "$TOK_DIR2")" | json .nome)"
R="$(req GET "/chamada?turmaId=$TURMA_ID&data=$DIA" "" "$TOK_DIR2")"
check "diretora B não acessa chamada da turma da escola A → 403" "403" "$(code_of "$R")"
R="$(req GET "/relatorios/resumo?turmaId=$TURMA_ID&ano=2026" "" "$TOK_DIR2")"
check "diretora B não acessa relatório da turma da escola A → 403" "403" "$(code_of "$R")"

# --- limpeza --------------------------------------------------------------
# Remove as escolas criadas nesta execução (não há rota DELETE /escola).
# Best-effort via psql no container docker; pule com KEEP_DATA=1.

if [ "${KEEP_DATA:-}" != "1" ] && command -v docker >/dev/null 2>&1; then
  NOMES="ARRAY['Escola Smoke $TS','Escola B $TS','Escola Repetida']"
  SQL="
    DELETE FROM \"Aluno\" WHERE \"turmaId\" IN (SELECT t.id FROM \"Turma\" t JOIN \"Escola\" e ON e.id=t.\"escolaId\" WHERE e.nome = ANY($NOMES));
    DELETE FROM \"Turma\" WHERE \"escolaId\" IN (SELECT id FROM \"Escola\" WHERE nome = ANY($NOMES));
    DELETE FROM \"Usuario\" WHERE \"escolaId\" IN (SELECT id FROM \"Escola\" WHERE nome = ANY($NOMES));
    DELETE FROM \"Escola\" WHERE nome = ANY($NOMES);"
  if docker exec -i escola-imaculada-db psql -U escola -d escola_imaculada -q -c "$SQL" >/dev/null 2>&1; then
    printf '\n%slimpeza: escolas de teste removidas%s\n' "$DIM" "$Z"
  else
    printf '\n%slimpeza: não deu pra remover as escolas de teste (ok, são inofensivas)%s\n' "$DIM" "$Z"
  fi
fi

# --- resumo -----------------------------------------------------------------

printf '\n%s─────────────────────────────%s\n' "$DIM" "$Z"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  printf '%s✓ %d/%d passaram%s\n' "$G" "$PASS" "$TOTAL" "$Z"
  exit 0
else
  printf '%s✗ %d/%d falharam%s (%d ok)\n' "$RED" "$FAIL" "$TOTAL" "$Z" "$PASS"
  exit 1
fi
