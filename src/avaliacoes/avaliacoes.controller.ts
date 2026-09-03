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
import { AvaliacoesService } from './avaliacoes.service.js';
import {
  AvaliacaoDto,
  ListarAvaliacoesQueryDto,
} from './dto/avaliacao.dto.js';

@Controller('avaliacoes')
@UseGuards(JwtAuthGuard)
export class AvaliacoesController {
  constructor(private readonly avaliacoes: AvaliacoesService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthUser,
    @Query() query: ListarAvaliacoesQueryDto,
  ) {
    return this.avaliacoes.listar(user, query);
  }

  @Post()
  @HttpCode(201)
  criar(@CurrentUser() user: AuthUser, @Body() dto: AvaliacaoDto) {
    return this.avaliacoes.criar(user, dto);
  }

  @Put(':id')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AvaliacaoDto,
  ) {
    return this.avaliacoes.atualizar(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.avaliacoes.remover(user, id);
  }
}
