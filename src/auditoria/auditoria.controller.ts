import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { AuditoriaService } from './auditoria.service.js';
import { ListarAuditoriaDto } from './dto/listar-auditoria.dto.js';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRETORA')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthUser,
    @Query() query: ListarAuditoriaDto,
  ) {
    return this.auditoria.listar(user, query);
  }
}
