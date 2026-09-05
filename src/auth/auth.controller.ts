import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { RateLimit } from '../common/rate-limit.decorator.js';
import { AuthService, TokenResponse } from './auth.service.js';
import { CadastroInicialDto } from './dto/cadastro-inicial.dto.js';
import { LoginDto } from './dto/login.dto.js';

const AUTH_LIMIT =
  Number(process.env.THROTTLE_AUTH_LIMIT) > 0
    ? Number(process.env.THROTTLE_AUTH_LIMIT)
    : 5;

@Controller('auth')
@RateLimit({ ttl: 60, limit: AUTH_LIMIT })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<TokenResponse> {
    return this.auth.login(dto);
  }

  @Post('cadastro-inicial')
  @HttpCode(201)
  cadastroInicial(@Body() dto: CadastroInicialDto): Promise<TokenResponse> {
    return this.auth.cadastroInicial(dto);
  }
}
