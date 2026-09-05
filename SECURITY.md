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
| Config | `validateEnv` no boot: recusa subir sem `DATABASE_URL` e sem `JWT_SECRET` forte (≥32 chars, não pode ser valor de exemplo). |
| Vazamento de erro | `PrismaExceptionFilter` traduz erros do Prisma e nunca expõe stack trace / detalhes internos. |
| CORS | Origins vindos de `CORS_ORIGIN` (lista), sem wildcard. |

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

2. **Exposição de CPF nas respostas.**
   `GET /professoras` devolve o CPF completo. Avaliar mascarar (`***.***.***-99`)
   ou remover onde a UI não precisar do valor cheio.

3. **Revogação de token.**
   JWT sem `jti`/blacklist: uma professora removida mantém acesso até o token
   expirar (8h). Aceitável hoje; se precisar de revogação imediata, adotar
   lista de revogação ou refresh tokens curtos.

4. **Cadastro inicial aberto.**
   `POST /auth/cadastro-inicial` cria escola + conta sem verificação. Protegido
   por rate limit; considerar verificação de e-mail ou aprovação manual.

5. **Log de auditoria.**
   Não há registro de quem criou/alterou/excluiu aluno, chamada, avaliação etc.
   A LGPD pede rastreabilidade. Avaliar uma tabela de auditoria ou middleware
   que registre `usuarioId + ação + entidade + timestamp` nas mutações.

6. **Dependências de ferramentas de dev com CVE.**
   `npm audit` acusa vulnerabilidades em pacotes **fora do runtime de produção**:
   - `mysql2` / `deepmerge-ts` — transitivos do CLI `prisma` (devDependency; o
     app usa Postgres, `mysql2` nunca é carregado).
   - `undici` / `tmp` / `inquirer` — transitivos de `@nestjs/mau` (devDependency,
     CLI de deploy).

   `npm audit fix --force` faria downgrade do Prisma 7→6 (breaking). Ações
   recomendadas: remover `@nestjs/mau` se `nest deploy` não for usado; atualizar
   o Prisma quando sair correção não-breaking; rodar `npm audit` no CI.

7. **HTTPS / TLS.**
   Garantir no deploy: HTTPS obrigatório (redirect + HSTS já vem do helmet),
   TLS na conexão com o Postgres, e headers de segurança também no host que
   serve o frontend (incl. `frame-ancestors`, ignorado em `<meta>`).

8. **Sem testes automatizados.**
   Guards, validadores e regras de negócio novos não têm cobertura de
   regressão. Priorizar e2e para: acesso cross-tenant negado, rate limit,
   CPF/data inválidos, chamada 409, falta sem `F`.

9. **Algoritmo de hash de senha.**
   `bcryptjs` custo 10. Considerar custo 12 ou migração para `argon2id`.
