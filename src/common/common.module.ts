import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from '../auth/jwt.strategy.js';
import { AcessoService } from './acesso.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RateLimitGuard } from './rate-limit.guard.js';

const passport = PassportModule.register({ defaultStrategy: 'jwt' });

@Global()
@Module({
  imports: [passport],
  providers: [
    AcessoService,
    JwtStrategy,
    // Ordem importa: rate limit primeiro (vale p/ rotas públicas também),
    // depois a exigência de JWT global (rotas liberadas usam @Public()).
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AcessoService, JwtStrategy, passport],
})
export class CommonModule {}
