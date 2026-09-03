import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { TurmaDto } from './dto/turma.dto.js';
import { TurmasService } from './turmas.service.js';

@Controller('turmas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TurmasController {
  constructor(private readonly turmas: TurmasService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser) {
    return this.turmas.listar(user);
  }

  @Post()
  @Roles('DIRETORA')
  @HttpCode(201)
  criar(@CurrentUser() user: AuthUser, @Body() dto: TurmaDto) {
    return this.turmas.criar(user, dto);
  }

  @Put(':id')
  @Roles('DIRETORA')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TurmaDto,
  ) {
    return this.turmas.atualizar(user, id, dto);
  }

  @Delete(':id')
  @Roles('DIRETORA')
  @HttpCode(204)
  async remover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.turmas.remover(user, id);
  }
}
