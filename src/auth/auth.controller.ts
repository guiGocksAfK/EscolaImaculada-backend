import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { AuthService, TokenResponse } from './auth.service.js';
import { CadastroInicialDto } from './dto/cadastro-inicial.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
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
