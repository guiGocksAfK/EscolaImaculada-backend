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
import { ConteudoService } from './conteudo.service.js';
import {
  ConteudoDto,
  ListarConteudoQueryDto,
} from './dto/conteudo.dto.js';

@Controller('conteudo')
@UseGuards(JwtAuthGuard)
export class ConteudoController {
  constructor(private readonly conteudo: ConteudoService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthUser,
    @Query() query: ListarConteudoQueryDto,
  ) {
    return this.conteudo.listar(user, query);
  }

  @Post()
  @HttpCode(201)
  criar(@CurrentUser() user: AuthUser, @Body() dto: ConteudoDto) {
    return this.conteudo.criar(user, dto);
  }

  @Put(':id')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConteudoDto,
  ) {
    return this.conteudo.atualizar(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.conteudo.remover(user, id);
  }
}
