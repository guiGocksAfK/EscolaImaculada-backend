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
import {
  CreateProfessoraDto,
  UpdateProfessoraDto,
} from './dto/professora.dto.js';
import { ProfessorasService } from './professoras.service.js';

@Controller('professoras')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfessorasController {
  constructor(private readonly professoras: ProfessorasService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser) {
    return this.professoras.listar(user);
  }

  @Post()
  @Roles('DIRETORA')
  @HttpCode(201)
  criar(@CurrentUser() user: AuthUser, @Body() dto: CreateProfessoraDto) {
    return this.professoras.criar(user, dto);
  }

  @Put(':id')
  @Roles('DIRETORA')
  atualizar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProfessoraDto,
  ) {
    return this.professoras.atualizar(user, id, dto);
  }

  @Delete(':id')
  @Roles('DIRETORA')
  @HttpCode(204)
  async remover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.professoras.remover(user, id);
  }
}
