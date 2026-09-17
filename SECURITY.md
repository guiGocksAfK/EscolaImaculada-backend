# Segurança — EscolaImaculada (backend)

Resumo das proteções em vigor e do que ainda precisa de decisão.

## Em vigor

| Área | Como |
|---|---|
| Senhas | `bcrypt` (custo 10) com salt por usuário. Nunca retornadas nas respostas. Cap de 72 chars no cadastro (limite real do bcrypt). |
| Login (timing) | `bcrypt.compare` roda mesmo quando o CPF não existe (hash dummy), para não vazar por tempo de resposta se um CPF está cadastrado. |
| SQL injection | Todo acesso a banco via query builder do Prisma (parametrizado). Nenhum `$queryRawUnsafe`/`$executeRawUnsafe`. |
| Autenticação | JWT (HS256). `JwtAuthGuard` é **global** (`APP_GUARD`) — toda rota exige token, exceto as marcadas com `@Public()` (hoje só `/auth/*`). |
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

3. **Revogação de token.**
   JWT sem `jti`/blacklist: uma professora removida mantém acesso até o token
   expirar (8h). Aceitável hoje; se precisar de revogação imediata, adotar
   lista de revogação ou refresh tokens curtos.

4. **Cadastro inicial aberto.**
   `POST /auth/cadastro-inicial` cria escola + conta sem verificação. Protegido
   por rate limit; considerar verificação de e-mail ou aprovação manual.

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

9. **Algoritmo de hash de senha.**
   `bcryptjs` custo 10. Considerar custo 12 ou migração para `argon2id`.
