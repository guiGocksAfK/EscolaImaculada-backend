import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { AlunosService } from './alunos.service.js';
import {
  AlterarStatusDto,
  CreateAlunoDto,
  ListarAlunosQueryDto,
  UpdateAlunoDto,
} from './dto/aluno.dto.js';

@Controller('alunos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlunosController {
  constructor(private readonly alunos: AlunosService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthUser,
    @Query() query: ListarAlunosQueryDto,
  ) {
    return this.alunos.listar(user, query);
  }

  @Post()
  @Roles('DIRETORA')
  @HttpCode(201)
  criar(@CurrentUser() user: AuthUser, @Body() dto: CreateAlunoDto) {
    return this.alunos.criar(user, dto);
  }

  @Put(':id')
  @Roles('DIRETORA')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAlunoDto,
  ) {
    return this.alunos.atualizar(user, id, dto);
  }

  @Patch(':id/status')
  @Roles('DIRETORA')
  alterarStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AlterarStatusDto,
  ) {
    return this.alunos.alterarStatus(user, id, dto.status);
  }

  @Delete(':id')
  @Roles('DIRETORA')
  @HttpCode(204)
  async remover(@Param('id') id: string) {
    await this.alunos.remover(id);
  }
}
