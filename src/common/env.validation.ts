/**
 * Validação das variáveis de ambiente no boot. Passada para
 * `ConfigModule.forRoot({ validate })` — se algo estiver errado, a
 * aplicação nem sobe, em vez de falhar de formas obscuras em runtime.
 */

/** Valores de exemplo que NÃO podem ir para produção. */
const SEGREDOS_PROIBIDOS = new Set([
  'troque-este-segredo-em-producao',
  'changeme',
  'secret',
]);

const JWT_SECRET_MIN_LEN = 32;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const erros: string[] = [];

  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    erros.push('DATABASE_URL é obrigatória');
  }

  const jwtSecret = config.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.length === 0) {
    erros.push('JWT_SECRET é obrigatória');
  } else if (jwtSecret.length < JWT_SECRET_MIN_LEN) {
    erros.push(
      `JWT_SECRET deve ter ao menos ${JWT_SECRET_MIN_LEN} caracteres ` +
        `(gere com: openssl rand -base64 48)`,
    );
  } else if (SEGREDOS_PROIBIDOS.has(jwtSecret.trim().toLowerCase())) {
    erros.push('JWT_SECRET está com um valor de exemplo — defina um segredo real');
  }

  const expiresIn = config.JWT_EXPIRES_IN;
  if (expiresIn !== undefined && typeof expiresIn !== 'string') {
    erros.push('JWT_EXPIRES_IN deve ser uma string (ex: "8h")');
  }

  // Em produção, alguns defaults de dev (pensados pra rodar tudo em
  // localhost) viram furo de segurança se ninguém trocar — falha no boot
  // em vez de deixar subir apontando pro lugar errado.
  if (config.NODE_ENV === 'production') {
    const corsOrigin = config.CORS_ORIGIN;
    if (typeof corsOrigin !== 'string' || corsOrigin.trim().length === 0) {
      erros.push(
        'CORS_ORIGIN é obrigatória em produção (sem ela cai no default ' +
          'http://localhost:4200 e o frontend real fica bloqueado)',
      );
    } else if (corsOrigin.includes('localhost')) {
      erros.push('CORS_ORIGIN em produção não pode apontar para localhost');
    }

    if (typeof databaseUrl === 'string' && databaseUrl.includes('localhost')) {
      erros.push('DATABASE_URL em produção não pode apontar para localhost');
    }
  }

  if (erros.length > 0) {
    throw new Error(`Configuração inválida:\n  - ${erros.join('\n  - ')}`);
  }

  return config;
}
