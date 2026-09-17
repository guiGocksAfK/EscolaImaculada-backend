# Segurança — EscolaImaculada (backend)

Resumo das proteções em vigor e do que ainda precisa de decisão.

## Em vigor

| Área | Como |
|---|---|
| Senhas | `bcrypt` (custo 12) com salt por usuário. Nunca retornadas nas respostas. Mínimo de 10 e cap de 72 chars (limite real do bcrypt). O mínimo vale para criação/troca; quem já tem senha curta continua conseguindo entrar. |
| Login (timing) | `bcrypt.compare` roda mesmo quando o CPF não existe (hash dummy), para não vazar por tempo de resposta se um CPF está cadastrado. |
| SQL injection | Todo acesso a banco via query builder do Prisma (parametrizado). Nenhum `$queryRawUnsafe`/`$executeRawUnsafe`. |
| Autenticação | JWT (HS256). `JwtAuthGuard` é **global** (`APP_GUARD`) — toda rota exige token, exceto as marcadas com `@Public()` (hoje só `/auth/*` e `GET /escola/publica`). A cada requisição a `JwtStrategy` confere a conta no banco: removida => 401 imediato, e papel/escola vêm de lá, não das claims. |
| Autorização | `RolesGuard` (`@Roles('DIRETORA')`) + `AcessoService` para escopo multi-tenant por escola/turma em **todas** as operações, inclusive `DELETE /alunos/:id`. |
| Rate limiting | `RateLimitGuard` global (janela fixa em memória por IP+rota). Padrão 120 req/min; `/auth/*` = 5 req/min. Configurável por env. Atrás de proxy, exige `TRUST_PROXY`. |
| Validação de entrada | `ValidationPipe` com `whitelist: true` + `forbidNonWhitelisted: true`. DTOs com `class-validator`: `@MaxLength` em todo campo string, `@ArrayMaxSize` na chamada, CPF com dígito verificador (`@IsCpf`), datas de calendário válidas e não futuras (`@IsDataRazoavel`). |
| Regras de negócio | Chamada lançada não pode ser reeditada (409). Chamada só aceita alunos da própria turma. Falta justificada exige `F` na chamada do dia. |
| Tamanho de requisição | Corpo limitado a 200 KB (`413` se exceder). |
| Headers HTTP | `helmet()` — CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, sem `X-Powered-By`. |
| Config | `validateEnv` no boot: recusa subir sem `DATABASE_URL` e sem `JWT_SECRET` forte (≥32 chars, não pode ser valor de exemplo). Em produção também exige `TRUST_PROXY` explícito (senão o rate limit conta todo mundo pelo IP do proxy) e recusa `RATE_LIMIT_DISABLED`. |
| Vazamento de erro | `PrismaExceptionFilter` traduz erros do Prisma e nunca expõe stack trace / detalhes internos. |
| CORS | Origins vindos de `CORS_ORIGIN` (lista), sem wildcard. |
| Contêiner | Roda como usuário `node` (sem privilégio), não root. Imagem final sem devDependencies (`npm prune --omit=dev`). |
| Dados pessoais nas respostas | CPF de aluno e de professora sai mascarado (`***.***.***-99`) — o valor cheio nunca deixa a API. |
| Auditoria | `AuditoriaInterceptor` (global) grava toda escrita autenticada (POST/PUT/PATCH/DELETE), inclusive as que falham (403/404/409). Sem corpo da requisição. `GET /auditoria` (só DIRETORA) lê a trilha da própria escola. |

## Pendências / decisões abertas

1. **Criptografia em repouso dos dados pessoais (LGPD).**
   CPF, nome dos pais, endereço, data e local de nascimento de crianças estão
   em texto plano no Postgres. Recomendações, em ordem de esforço:
   - **Mínimo:** habilitar criptografia de disco/volume no servidor do banco e
     forçar TLS na conexão (`sslmode=require` na `DATABASE_URL`).
   - **Ideal:** criptografia de campo para CPF (AES-GCM com chave em
     secret manager). Impacto: quebra `@unique` e busca direta por CPF —
     exige coluna de hash determinístico para lookup/unicidade + migração.
   - Definir política de retenção/expurgo de alunos `TRANSFERIDO`/`DESISTENTE`.

2. ~~**Exposição de CPF nas respostas.**~~ Resolvido: `GET /professoras` e
   `GET /alunos` mascaram o CPF (`mascararCpf`), e o front só reenvia o campo
   quando a pessoa digita um CPF novo.

3. ~~**Revogação de token.**~~ Resolvido sem blacklist: a `JwtStrategy`
   consulta a conta no banco a cada requisição e devolve papel e escola atuais
   (o token só diz *quem* é). Conta removida ou escola excluída => 401 na hora;
   mudança de papel vale na requisição seguinte, sem esperar o login. Custo:
   uma consulta por chave primária por requisição autenticada — se um dia
   pesar, ver a pendência 10.

4. ~~**Cadastro inicial aberto.**~~ Resolvido: o bootstrap é de uso único — a
   primeira escola entra normalmente, e qualquer outra exige
   `CADASTRO_INICIAL_ABERTO=1` no ambiente. Sem isso o endpoint ficaria aberto
   para sempre, e uma segunda escola criada por um estranho ainda derrubaria o
   nome na tela de login (`GET /escola/publica` só responde com uma escola).
   Para cadastrar outra escola de propósito, suba com a variável, cadastre e
   remova.

5. **Retenção da trilha de auditoria.**
   O log de auditoria (ver "Em vigor") cresce sem limite. Definir política de
   retenção/expurgo (ex.: manter 12–24 meses) e, se necessário, exportação.

6. **Dependências com CVE.**
   - `multer` (transitivo de `@nestjs/platform-express`, dependência de
     produção de verdade): **corrigido** com `npm audit fix` — 2.2.0 → 2.4.0.
     Não era explorável, já que o projeto não tem rota de upload e o multer
     nunca chega a ser instanciado, mas era o único CVE no caminho de execução.
   - `mysql2` / `deepmerge-ts` — transitivos do CLI `prisma`. Atenção: `prisma`
     é **dependency**, não devDependency, porque o `start:prod` roda
     `prisma migrate deploy`; logo os dois vão para a imagem de produção. Não
     são carregados em runtime (o datasource é Postgres), mas a correção exige
     downgrade do Prisma 7→6 (`npm audit fix --force`, breaking). Reavaliar
     quando sair correção não-breaking.
   - `undici` / `tmp` / `inquirer` — transitivos de `@nestjs/mau` (devDependency,
     CLI de deploy). Fora da imagem desde o `npm prune --omit=dev`. Remover
     `@nestjs/mau` se `nest deploy` não for usado.

   Rodar `npm audit` no CI.

7. **HTTPS / TLS.**
   No frontend já foi feito: o `vercel.json` manda CSP (com `frame-ancestors`),
   `X-Frame-Options`, HSTS, `Referrer-Policy` e `nosniff` como headers HTTP.
   Falta garantir na API: HTTPS obrigatório no Caddy (redirect) e TLS na
   conexão com o Postgres — confirmar `sslmode=require` na `DATABASE_URL` do
   Neon.

8. **Sem testes automatizados.**
   Guards, validadores e regras de negócio novos não têm cobertura de
   regressão. Priorizar e2e para: acesso cross-tenant negado, rate limit,
   CPF/data inválidos, chamada 409, falta sem `F`.

9. ~~**Algoritmo de hash de senha.**~~ Custo subiu para 12 (cada ponto dobra o
   trabalho do atacante offline; ~200ms por login, imperceptível). Hashes
   antigos seguem válidos, porque o custo vai gravado no próprio hash — eles
   migram sozinhos quando a senha for trocada. `argon2id` continua sendo o
   passo seguinte, se um dia valer a dependência nativa.

10. **Cache da verificação de conta — só se a latência pesar.**
    A `JwtStrategy` consulta o banco a cada requisição (ver pendência 3). Hoje
    isso não é problema: quase toda rota já faz de 1 a 5 consultas para montar
    a resposta, e essa é a mais barata delas (chave primária, uma linha). Não
    otimizar antes de medir — se a API estiver lenta, suspeitar primeiro do
    cold start do Neon e do registro semestral.

    Se um dia for necessário, o desenho certo é **TTL curto + invalidação
    explícita**, não TTL sozinho:
    - cache em memória por `usuarioId`, guardando `{ nome, papel, escolaId }`,
      com TTL de 5–10s;
    - `professoras.remover`/`atualizar` e `escola.excluir` derrubam a entrada
      do usuário afetado.

    Assim a revogação continua imediata nos fluxos do sistema, e o TTL só
    cobre mudanças feitas por fora (alguém editando o banco na mão). A janela
    de exposição passa a ser o TTL — o evento é humano (a diretora clicando em
    excluir), então poucos segundos não mudam nada na prática; o que importava
    era fechar a janela de 8h do token. Em múltiplas instâncias, cada uma teria
    seu próprio cache: a invalidação deixaria de ser confiável e aí o certo
    seria um store compartilhado, como no rate limit.

11. **JWT no `localStorage` do front — e por que a troca não é óbvia.**
    O token fica em `localStorage` (`ei.token`), então um XSS no front consegue
    roubá-lo e usar por até 8h. A CSP restritiva (header no `vercel.json`, sem
    `unsafe-eval`, sem origem externa em `script-src`) é a defesa que está de
    pé hoje; o ideal seria cookie `httpOnly`, fora do alcance de JavaScript.

    O que trava: front (Vercel) e API (duckdns) são **sites diferentes**, então
    o cookie precisaria de `SameSite=None`. Isso **cria uma superfície de CSRF
    que hoje não existe** — token em header `Authorization` é imune a CSRF por
    construção, cookie enviado automaticamente pelo navegador não é. Trocar sem
    tratar isso é trocar um risco por outro, não reduzir risco.

    Caminho certo, na ordem:
    1. colocar front e API sob o mesmo domínio (Caddy servindo o front, ou
       rewrite `/api` na Vercel) — é decisão de infra, não de código;
    2. aí sim cookie `httpOnly; Secure; SameSite=Strict`, que dispensa CSRF
       token porque o navegador não manda o cookie em requisição de outro site;
    3. no front, trocar o `jwtDecode` por um `GET /auth/eu`, já que a página
       deixa de conseguir ler o token para saber nome e papel.

    Fazer os três juntos. O passo 2 sozinho, com os domínios separados, piora.
