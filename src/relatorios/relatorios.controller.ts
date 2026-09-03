import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { ResumoQueryDto } from './dto/resumo-query.dto.js';
import { RelatoriosService } from './relatorios.service.js';

@Controller('relatorios')
@UseGuards(JwtAuthGuard)
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get('resumo')
  resumo(@CurrentUser() user: AuthUser, @Query() query: ResumoQueryDto) {
    return this.relatorios.resumoPorAluno(user, query);
  }
}
