#!/usr/bin/env bash
#
# Smoke test da API — exercita todos os módulos de ponta a ponta contra um
# backend rodando (padrão http://localhost:3000).
#
#   Uso:   RATE_LIMIT_DISABLED=1 npm run start:dev      # sobe o servidor
#          bash test/smoke.sh                            # roda os testes
#
#          BASE_URL=http://localhost:3000 bash test/smoke.sh
#
# IMPORTANTE: suba o servidor com RATE_LIMIT_DISABLED=1, senão o próprio
# script toma 429 nas dezenas de chamadas a /auth. O teste de rate limit
# em si roda à parte, com SMOKE_RATELIMIT=1 e o servidor na config normal.
#
# Cada execução cria escolas novas (CPFs válidos e únicos por timestamp),
# então pode rodar quantas vezes quiser sem resetar o banco. Sai != 0 se
# qualquer verificação falhar.

set -u

BASE="${BASE_URL:-http://localhost:3000}"
TS="$(date +%s)"
TS="${TS: -9}"

# cpf <n> — gera um CPF VÁLIDO (com dígitos verificadores) e único por
# execução+índice. Precisa passar no @IsCpf() do backend.
cpf() {
  local seed="${TS:0:7}$(printf '%02d' "$1")"
  node -e '
    const base = String(process.argv[1]).replace(/\D/g, "").slice(-9).padStart(9, "0");
    const dv = (b) => { let s = 0; for (let i = 0; i < b.length; i++) s += (+b[i]) * (b.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    const d1 = dv(base); const d2 = dv(base + d1);
    process.stdout.write(base + d1 + d2);
  ' "$seed"
}

# chamada só aceita a data de hoje — tudo abaixo usa o ano/mês reais
ANO_HOJE="$(date +%Y)"
MES_HOJE="$(date +%-m)"
SEM_HOJE=$([ "$MES_HOJE" -le 7 ] && echo 1 || echo 2)
MESES_NO_SEM=$([ "$SEM_HOJE" = 1 ] && echo 6 || echo 5)
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

# check_ne <label> <nao-esperado> <obtido>
check_ne() {
  if [ "$2" != "$3" ]; then
    PASS=$((PASS + 1)); printf '  %s✓%s %s\n' "$G" "$Z" "$1"
  else
    FAIL=$((FAIL + 1)); printf '  %s✗%s %s %s(não podia ser %s)%s\n' "$RED" "$Z" "$1" "$DIM" "$2" "$Z"
  fi
}

section() { printf '\n%s== %s ==%s\n' "$Y" "$1" "$Z"; }

# --- 0. servidor no ar ---------------------------------------------------

section "Servidor"
PING="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/auth/login" -X POST -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo 000)"
if [ "$PING" = "000" ]; then
  printf '%s✗ backend não respondeu em %s%s\n' "$RED" "$BASE" "$Z"
  printf '   Suba com: docker compose up -d && RATE_LIMIT_DISABLED=1 npm run start:dev\n'
  exit 1
fi
check "backend respondendo em $BASE" "400" "$PING"

if [ "$PING" = "429" ]; then
  printf '%s! servidor está com rate limit ligado — suba com RATE_LIMIT_DISABLED=1%s\n' "$RED" "$Z"
  exit 1
fi

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
check "login CPF válido não cadastrado → 401" "401" "$(code_of "$(req POST /auth/login "{\"cpf\":\"$(cpf 98)\",\"senha\":\"seja\"}")")"
check "validação: body vazio → 400" "400" "$(code_of "$(req POST /auth/login '{}')")"
check "rota protegida sem token → 401" "401" "$(code_of "$(req GET /escola)")"
check "GET /escola/publica sem token → 200" "200" "$(code_of "$(req GET /escola/publica)")"
check "GET /escola/publica não exige auth (tem campo nome)" "sim" "$(body_of "$(req GET /escola/publica)" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log('nome' in JSON.parse(s)?'sim':'não')}catch{console.log('não')}})")"

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
check_ne "POST /professoras devolve CPF mascarado" "$CPF_P1" "$(body_of "$R" | json .cpf)"

req POST /professoras "{\"nome\":\"Prof Dois\",\"cpf\":\"$CPF_P2\",\"dataNascimento\":\"1991-06-06\",\"senha\":\"prof123\"}" "$TOK_DIR" >/dev/null

R="$(req POST /professoras "{\"nome\":\"Dup\",\"cpf\":\"$CPF_P1\",\"dataNascimento\":\"1990-05-05\",\"senha\":\"prof123\"}" "$TOK_DIR")"
check "POST /professoras CPF repetido → 409" "409" "$(code_of "$R")"

R="$(req GET /professoras "" "$TOK_DIR")"
check "GET /professoras lista as 2" "2" "$(body_of "$R" | json .length)"
check "GET /professoras: CPF vem mascarado" "***.***.***-${CPF_P1: -2}" "$(body_of "$R" | json '.find(p=>p.id==="'"$PROF1_ID"'").cpf')"

# edição sem enviar CPF → mantém o atual
R="$(req PUT "/professoras/$PROF1_ID" "{\"nome\":\"Prof Um Editada\",\"dataNascimento\":\"1990-05-05\"}" "$TOK_DIR")"
check "PUT /professoras/:id (sem CPF/senha) → 200" "200" "$(code_of "$R")"
check "PUT /professoras/:id salva nome" "Prof Um Editada" "$(body_of "$R" | json .nome)"

# login como professora 1 — CPF preservado após a edição
TOK_P1="$(body_of "$(req POST /auth/login "{\"cpf\":\"$CPF_P1\",\"senha\":\"prof123\"}")" | json .accessToken)"
[ -n "$TOK_P1" ] && check "professora loga (CPF preservado na edição)" "sim" "sim" || check "professora loga (CPF preservado na edição)" "sim" "não"

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
R="$(req POST /alunos "{\"nome\":\"Aluno Teste\",\"cpf\":\"\",\"dataNascimento\":\"2020-03-03\",\"nomePai\":\"Pai\",\"nomeMae\":\"Mae\",\"localNascimento\":\"Curitiba\",\"endereco\":\"Rua Z\",\"turmaId\":\"$TURMA_ID\"}" "$TOK_DIR")"
check "POST /alunos → 201" "201" "$(code_of "$R")"
ALUNO_ID="$(body_of "$R" | json .id)"
check "aluno nasce ATIVO" "ATIVO" "$(body_of "$R" | json .status)"

# 2º aluno, com CPF válido — pra checar o mascaramento
CPF_AL="$(cpf 4)"
R="$(req POST /alunos "{\"nome\":\"Aluno Dois\",\"cpf\":\"$CPF_AL\",\"dataNascimento\":\"2020-04-04\",\"nomePai\":\"Pai\",\"nomeMae\":\"Mae\",\"localNascimento\":\"Curitiba\",\"endereco\":\"Rua Y\",\"turmaId\":\"$TURMA_ID\"}" "$TOK_DIR")"
ALUNO2_ID="$(body_of "$R" | json .id)"
check "POST /alunos (com CPF) devolve CPF mascarado" "***.***.***-${CPF_AL: -2}" "$(body_of "$R" | json .cpf)"

# 3º aluno, transferido — não pode entrar na chamada
R="$(req POST /alunos "{\"nome\":\"Aluno Transferido\",\"cpf\":\"\",\"dataNascimento\":\"2020-05-05\",\"nomePai\":\"Pai\",\"nomeMae\":\"Mae\",\"localNascimento\":\"Curitiba\",\"endereco\":\"Rua W\",\"turmaId\":\"$TURMA_ID\"}" "$TOK_DIR")"
ALUNO3_ID="$(body_of "$R" | json .id)"
req PATCH "/alunos/$ALUNO3_ID/status" '{"status":"TRANSFERIDO"}' "$TOK_DIR" >/dev/null

check "GET /alunos?turmaId lista 3" "3" "$(body_of "$(req GET "/alunos?turmaId=$TURMA_ID" "" "$TOK_DIR")" | json .length)"
check "GET /alunos?status=TRANSFERIDO lista 1" "1" "$(body_of "$(req GET "/alunos?status=TRANSFERIDO" "" "$TOK_DIR")" | json .length)"

R="$(req PATCH "/alunos/$ALUNO_ID/status" "{\"status\":\"TRANSFERIDO\"}" "$TOK_DIR")"
check "PATCH /alunos/:id/status → 200" "200" "$(code_of "$R")"
check "status virou TRANSFERIDO" "TRANSFERIDO" "$(body_of "$R" | json .status)"
req PATCH "/alunos/$ALUNO_ID/status" '{"status":"ATIVO"}' "$TOK_DIR" >/dev/null

R="$(req PUT "/alunos/$ALUNO_ID" "{\"nome\":\"Aluno Editado\",\"cpf\":\"\",\"dataNascimento\":\"2020-03-03\",\"nomePai\":\"Pai\",\"nomeMae\":\"Mae\",\"localNascimento\":\"Curitiba\",\"endereco\":\"Rua Z\",\"turmaId\":\"$TURMA_ID\",\"status\":\"ATIVO\"}" "$TOK_DIR")"
check "PUT /alunos/:id → 200" "200" "$(code_of "$R")"

# --- 6. Chamada ---------------------------------------------------------

section "Chamada"
DIA="$(date +%Y-%m-%d)" # chamada só aceita a data de hoje

# antes de lançar: aluno que não é da turma → 400
R="$(req PUT /chamada "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"registros\":[{\"alunoId\":\"00000000-0000-0000-0000-000000000000\",\"status\":\"C\"}]}" "$TOK_DIR")"
check "chamada com aluno de outra turma → 400" "400" "$(code_of "$R")"

# data futura na chamada → 400 (data de calendário válida mas não é hoje → 403;
# então usamos uma data impossível pra bater no validador de formato)
R="$(req PUT /chamada "{\"turmaId\":\"$TURMA_ID\",\"data\":\"2020-02-31\",\"registros\":[]}" "$TOK_DIR")"
check "chamada com data inexistente → 400" "400" "$(code_of "$R")"

# aluno transferido não entra na chamada → 400
R="$(req PUT /chamada "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"registros\":[{\"alunoId\":\"$ALUNO3_ID\",\"status\":\"F\"}]}" "$TOK_DIR")"
check "chamada com aluno transferido → 400" "400" "$(code_of "$R")"

R="$(req PUT /chamada "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"registros\":[{\"alunoId\":\"$ALUNO_ID\",\"status\":\"F\"},{\"alunoId\":\"$ALUNO2_ID\",\"status\":\"C\"}]}" "$TOK_DIR")"
check "PUT /chamada (lançamento) → 200" "200" "$(code_of "$R")"

R="$(req GET "/chamada?turmaId=$TURMA_ID&data=$DIA" "" "$TOK_DIR")"
check "GET /chamada do dia traz 2 registros" "2" "$(body_of "$R" | json .registros.length)"

# 2º lançamento no mesmo dia → bloqueado
R="$(req PUT /chamada "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"registros\":[{\"alunoId\":\"$ALUNO_ID\",\"status\":\"C\"}]}" "$TOK_DIR")"
check "chamada já lançada não é reeditável → 409" "409" "$(code_of "$R")"

R="$(req GET "/chamada/mensal?turmaId=$TURMA_ID&ano=$ANO_HOJE&mes=$MES_HOJE" "" "$TOK_DIR")"
check "GET /chamada/mensal → 200" "200" "$(code_of "$R")"
check "mensal lista o dia lançado" "$DIA" "$(body_of "$R" | json '.dias[0]')"

# --- 7. Conteúdo -------------------------------------------------------------

section "Conteúdo"
R="$(req POST /conteudo "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"disciplina\":\"Vogais\",\"euOutroNos\":\"Roda de conversa\"}" "$TOK_DIR")"
check "POST /conteudo (campos estruturados) → 201" "201" "$(code_of "$R")"
CONT_ID="$(body_of "$R" | json .id)"
check "conteudo: servidor renderiza o texto" "Conteúdo: Vogais"$'\n\n'"O eu, o outro e o nós: Roda de conversa" "$(body_of "$R" | json .conteudo)"
check "conteudo: campo estruturado volta" "Roda de conversa" "$(body_of "$R" | json .euOutroNos)"
check "POST /conteudo sem nenhum campo → 400" "400" "$(code_of "$(req POST /conteudo "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\"}" "$TOK_DIR")")"
check "POST /conteudo só com disciplina → 400" "400" "$(code_of "$(req POST /conteudo "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"disciplina\":\"só isso\"}" "$TOK_DIR")")"
check "POST /conteudo com campo não declarado → 400" "400" "$(code_of "$(req POST /conteudo "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"conteudo\":\"texto cru\"}" "$TOK_DIR")")"
check "GET /conteudo lista 1" "1" "$(body_of "$(req GET "/conteudo?turmaId=$TURMA_ID" "" "$TOK_DIR")" | json .length)"
check "PUT /conteudo/:id → 200" "200" "$(code_of "$(req PUT "/conteudo/$CONT_ID" "{\"turmaId\":\"$TURMA_ID\",\"data\":\"$DIA\",\"disciplina\":\"Numeros\",\"espacoTempo\":\"Contagem ate 10\"}" "$TOK_DIR")")"
check "DELETE /conteudo/:id → 204" "204" "$(code_of "$(req DELETE "/conteudo/$CONT_ID" "" "$TOK_DIR")")"

# --- 8. Avaliações -----------------------------------------------------------

section "Avaliações"
R="$(req POST /avaliacoes "{\"alunoId\":\"$ALUNO_ID\",\"turmaId\":\"$TURMA_ID\",\"texto\":\"Otimo desenvolvimento\",\"referencia\":\"1o semestre 2026\"}" "$TOK_DIR")"
check "POST /avaliacoes → 201" "201" "$(code_of "$R")"
AVAL_ID="$(body_of "$R" | json .id)"
check "avaliação traz aluno e turma" "Aluno Editado" "$(body_of "$R" | json .aluno.nome)"
check "GET /avaliacoes?alunoId lista 1" "1" "$(body_of "$(req GET "/avaliacoes?alunoId=$ALUNO_ID" "" "$TOK_DIR")" | json .length)"
check "PUT /avaliacoes/:id → 200" "200" "$(code_of "$(req PUT "/avaliacoes/$AVAL_ID" "{\"alunoId\":\"$ALUNO_ID\",\"turmaId\":\"$TURMA_ID\",\"texto\":\"Evoluiu bem\",\"referencia\":\"1o semestre 2026\"}" "$TOK_DIR")")"

# avaliação de outro ano — não deve entrar no resumo de ${ANO_HOJE}
req POST /avaliacoes "{\"alunoId\":\"$ALUNO_ID\",\"turmaId\":\"$TURMA_ID\",\"texto\":\"Ano diferente\",\"referencia\":\"2o semestre 2099\"}" "$TOK_DIR" >/dev/null
check "GET /avaliacoes?alunoId lista 2 (todos os anos)" "2" "$(body_of "$(req GET "/avaliacoes?alunoId=$ALUNO_ID" "" "$TOK_DIR")" | json .length)"

# --- 9. Faltas justificadas -----------------------------------------------

section "Faltas justificadas"
# ALUNO_ID consta como F no dia → pode justificar
R="$(req POST /faltas-justificadas "{\"alunoId\":\"$ALUNO_ID\",\"data\":\"$DIA\",\"motivo\":\"Atestado medico\"}" "$TOK_DIR")"
check "POST /faltas-justificadas (aluno faltou) → 201" "201" "$(code_of "$R")"
FALTA_ID="$(body_of "$R" | json .id)"
# ALUNO2_ID consta como C no dia → não pode justificar
R="$(req POST /faltas-justificadas "{\"alunoId\":\"$ALUNO2_ID\",\"data\":\"$DIA\",\"motivo\":\"Sem falta\"}" "$TOK_DIR")"
check "POST /faltas-justificadas (aluno presente) → 400" "400" "$(code_of "$R")"
check "GET /faltas-justificadas?turmaId lista 1" "1" "$(body_of "$(req GET "/faltas-justificadas?turmaId=$TURMA_ID" "" "$TOK_DIR")" | json .length)"

# --- 10. Relatórios ----------------------------------------------------------

section "Relatórios"
R="$(req GET "/relatorios/resumo?turmaId=$TURMA_ID&ano=$ANO_HOJE" "" "$TOK_DIR")"
check "GET /relatorios/resumo → 200" "200" "$(code_of "$R")"
check "resumo: 1 dia lançado" "1" "$(body_of "$R" | json .diasLancados)"
# linhas ordenadas por nome: [0]=Aluno Dois (C), [1]=Aluno Editado (F)
check "resumo: Aluno Dois com 1 presença" "1" "$(body_of "$R" | json '.linhas.find(l=>l.alunoNome==="Aluno Dois").presencas')"
check "resumo: Aluno Editado com 1 falta" "1" "$(body_of "$R" | json '.linhas.find(l=>l.alunoNome==="Aluno Editado").faltas')"
check "resumo: Aluno Editado com 1 falta justificada" "1" "$(body_of "$R" | json '.linhas.find(l=>l.alunoNome==="Aluno Editado").faltasJustificadas')"
check "resumo: só a avaliação do ano (a de 2099 é ignorada)" "1" "$(body_of "$R" | json '.linhas.find(l=>l.alunoNome==="Aluno Editado").avaliacoes.length')"

# registro semestral (montado no backend)
R="$(req GET "/relatorios/registro-semestral?turmaId=$TURMA_ID&ano=$ANO_HOJE&semestre=$SEM_HOJE" "" "$TOK_DIR")"
check "GET /relatorios/registro-semestral → 200" "200" "$(code_of "$R")"
check "registro-semestral: $MESES_NO_SEM meses no semestre" "$MESES_NO_SEM" "$(body_of "$R" | json .meses.length)"
check "registro-semestral: >=1 atendimento" "sim" "$([ "$(body_of "$R" | json .atendimentos)" -ge 1 ] 2>/dev/null && echo sim || echo não)"
check "registro-semestral: só avaliação do ano" "1" "$(body_of "$R" | json .avaliacoes.length)"
check "registro-semestral semestre inválido → 400" "400" "$(code_of "$(req GET "/relatorios/registro-semestral?turmaId=$TURMA_ID&ano=$ANO_HOJE&semestre=3" "" "$TOK_DIR")")"

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
check "diretora B não vê chamada da turma da escola A → 403" "403" "$(code_of "$(req GET "/chamada?turmaId=$TURMA_ID&data=$DIA" "" "$TOK_DIR2")")"
check "diretora B não vê relatório da turma da escola A → 403" "403" "$(code_of "$(req GET "/relatorios/resumo?turmaId=$TURMA_ID&ano=2026" "" "$TOK_DIR2")")"
check "diretora B não vê registro semestral da escola A → 403" "403" "$(code_of "$(req GET "/relatorios/registro-semestral?turmaId=$TURMA_ID&ano=2026&semestre=1" "" "$TOK_DIR2")")"
check "diretora B não edita aluno da escola A → 403" "403" "$(code_of "$(req PATCH "/alunos/$ALUNO_ID/status" '{"status":"DESISTENTE"}' "$TOK_DIR2")")"
check "diretora B não exclui aluno da escola A → 403" "403" "$(code_of "$(req DELETE "/alunos/$ALUNO_ID" "" "$TOK_DIR2")")"
check "diretora B não exclui professora da escola A → 404/403" "404" "$(code_of "$(req DELETE "/professoras/$PROF1_ID" "" "$TOK_DIR2")")"

# --- 12. Segurança / validação --------------------------------------------

section "Segurança / validação"

check "CPF inválido (dígito errado) no cadastro → 400" "400" "$(code_of "$(req POST /auth/cadastro-inicial "{\"escola\":{\"nome\":\"X $TS\",\"endereco\":\"y\"},\"diretora\":{\"nome\":\"Zé\",\"cpf\":\"11111111111\",\"dataNascimento\":\"1980-01-01\",\"senha\":\"senha123\"}}")")"
check "data de nascimento no futuro → 400" "400" "$(code_of "$(req POST /alunos "{\"nome\":\"Futuro\",\"cpf\":\"\",\"dataNascimento\":\"2099-01-01\",\"nomePai\":\"P\",\"nomeMae\":\"M\",\"localNascimento\":\"L\",\"endereco\":\"E\",\"turmaId\":\"$TURMA_ID\"}" "$TOK_DIR")")"
check "data inexistente no calendário (2020-02-31) → 400" "400" "$(code_of "$(req POST /alunos "{\"nome\":\"Data\",\"cpf\":\"\",\"dataNascimento\":\"2020-02-31\",\"nomePai\":\"P\",\"nomeMae\":\"M\",\"localNascimento\":\"L\",\"endereco\":\"E\",\"turmaId\":\"$TURMA_ID\"}" "$TOK_DIR")")"
check "campo não declarado no body → 400" "400" "$(code_of "$(req POST /avaliacoes "{\"alunoId\":\"$ALUNO_ID\",\"turmaId\":\"$TURMA_ID\",\"texto\":\"t\",\"referencia\":\"r\",\"hack\":1}" "$TOK_DIR")")"

# corpo acima de 200kb → 413 (payload grande vai por arquivo — linha de
# comando não aguenta 250 KB inline)
BIG_FILE="$(mktemp)"
node -e 'process.stdout.write(JSON.stringify({alunoId:process.argv[1],turmaId:process.argv[2],texto:"x".repeat(250000),referencia:"r"}))' "$ALUNO_ID" "$TURMA_ID" > "$BIG_FILE"
BIG_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/avaliacoes" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOK_DIR" --data-binary "@$BIG_FILE")"
rm -f "$BIG_FILE"
check "corpo > 200kb → 413" "413" "$BIG_CODE"

# headers do helmet
HDRS="$(curl -s -D - -o /dev/null "$BASE/auth/login" -X POST -H 'Content-Type: application/json' -d '{}')"
printf '%s' "$HDRS" | grep -qi 'x-content-type-options: nosniff' \
  && check "helmet: X-Content-Type-Options presente" "sim" "sim" \
  || check "helmet: X-Content-Type-Options presente" "sim" "não"
printf '%s' "$HDRS" | grep -qi 'x-powered-by' \
  && check "helmet: X-Powered-By removido" "ausente" "presente" \
  || check "helmet: X-Powered-By removido" "ausente" "ausente"

# --- 13. Auditoria ------------------------------------------------------------

section "Auditoria"
R="$(req GET "/auditoria?limite=50" "" "$TOK_DIR")"
check "GET /auditoria (diretora) → 200" "200" "$(code_of "$R")"
check_ne "auditoria registrou as mutações desta escola" "0" "$(body_of "$R" | json .length)"
check "auditoria registra método POST" "POST" "$(body_of "$R" | json '.find(a=>a.metodo==="POST").metodo')"
check "GET /auditoria como professora → 403" "403" "$(code_of "$(req GET /auditoria "" "$TOK_P1")")"

# --- 14. Rate limit (opcional) ---------------------------------------------
# Só roda com SMOKE_RATELIMIT=1 e o servidor SEM RATE_LIMIT_DISABLED.

if [ "${SMOKE_RATELIMIT:-}" = "1" ]; then
  section "Rate limit"
  RL_HIT=""
  for i in $(seq 1 12); do
    c="$(code_of "$(req POST /auth/login "{\"cpf\":\"$(cpf 1)\",\"senha\":\"x\"}")")"
    [ "$c" = "429" ] && RL_HIT="sim" && break
  done
  check "6+ logins rápidos disparam 429" "sim" "${RL_HIT:-não}"
fi

# --- limpeza --------------------------------------------------------------
# Remove as escolas criadas nesta execução (não há rota DELETE /escola).
# Best-effort via psql no container docker; pule com KEEP_DATA=1.

if [ "${KEEP_DATA:-}" != "1" ] && command -v docker >/dev/null 2>&1; then
  NOMES="ARRAY['Escola Smoke $TS','Escola B $TS','Escola Repetida','X $TS']"
  SQL="
    DELETE FROM \"RegistroAuditoria\" WHERE \"escolaId\" IN (SELECT id FROM \"Escola\" WHERE nome = ANY($NOMES));
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
