import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from '../auth/jwt.strategy.js';
import { AcessoService } from './acesso.service.js';
import { RateLimitGuard } from './rate-limit.guard.js';

const passport = PassportModule.register({ defaultStrategy: 'jwt' });

@Global()
@Module({
  imports: [passport],
  providers: [
    AcessoService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [AcessoService, JwtStrategy, passport],
})
export class CommonModule {}
