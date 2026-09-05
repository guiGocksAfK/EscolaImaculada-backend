import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  /** Janela em segundos. */
  ttl: number;
  /** Máximo de requisições por IP dentro da janela. */
  limit: number;
}

/**
 * Sobrescreve o limite global para um handler/controller específico.
 * Requer o RateLimitGuard (registrado como APP_GUARD).
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
