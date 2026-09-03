import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from '../auth/jwt.strategy.js';
import { AcessoService } from './acesso.service.js';

const passport = PassportModule.register({ defaultStrategy: 'jwt' });

@Global()
@Module({
  imports: [passport],
  providers: [AcessoService, JwtStrategy],
  exports: [AcessoService, JwtStrategy, passport],
})
export class CommonModule {}
