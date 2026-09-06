import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/**
 * Marca uma rota como pública, dispensando o JWT. Necessário porque o
 * JwtAuthGuard é global (APP_GUARD) — sem isto, toda rota exige token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
