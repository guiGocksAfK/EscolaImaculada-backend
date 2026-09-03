import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import {
  FaltaJustificadaDto,
  ListarFaltasQueryDto,
} from './dto/falta-justificada.dto.js';
import { FaltasJustificadasService } from './faltas-justificadas.service.js';

@Controller('faltas-justificadas')
@UseGuards(JwtAuthGuard)
export class FaltasJustificadasController {
  constructor(private readonly faltas: FaltasJustificadasService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthUser,
    @Query() query: ListarFaltasQueryDto,
  ) {
    return this.faltas.listar(user, query);
  }

  @Post()
  @HttpCode(201)
  criar(@CurrentUser() user: AuthUser, @Body() dto: FaltaJustificadaDto) {
    return this.faltas.criar(user, dto);
  }

  @Put(':id')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FaltaJustificadaDto,
  ) {
    return this.faltas.atualizar(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.faltas.remover(user, id);
  }
}
