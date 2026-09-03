import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { UpdateEscolaDto } from './dto/update-escola.dto.js';
import { EscolaService } from './escola.service.js';

@Controller('escola')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EscolaController {
  constructor(private readonly escola: EscolaService) {}

  @Get()
  obter(@CurrentUser() user: AuthUser) {
    return this.escola.obter(user);
  }

  @Put()
  @Roles('DIRETORA')
  atualizar(@CurrentUser() user: AuthUser, @Body() dto: UpdateEscolaDto) {
    return this.escola.atualizar(user, dto);
  }
}
