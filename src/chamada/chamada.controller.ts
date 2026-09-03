import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { ChamadaService } from './chamada.service.js';
import {
  ChamadaDiaQueryDto,
  ChamadaMensalQueryDto,
  SalvarChamadaDiaDto,
} from './dto/chamada.dto.js';

@Controller('chamada')
@UseGuards(JwtAuthGuard)
export class ChamadaController {
  constructor(private readonly chamada: ChamadaService) {}

  @Get()
  getDia(@CurrentUser() user: AuthUser, @Query() query: ChamadaDiaQueryDto) {
    return this.chamada.getDia(user, query);
  }

  @Put()
  salvarDia(@CurrentUser() user: AuthUser, @Body() dto: SalvarChamadaDiaDto) {
    return this.chamada.salvarDia(user, dto);
  }

  @Get('mensal')
  getMes(
    @CurrentUser() user: AuthUser,
    @Query() query: ChamadaMensalQueryDto,
  ) {
    return this.chamada.getMes(user, query);
  }
}
