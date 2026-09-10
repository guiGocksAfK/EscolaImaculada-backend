import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  UseGuards,
} from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { Public } from '../common/public.decorator.js';
import { RateLimit } from '../common/rate-limit.decorator.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { DeleteEscolaDto } from './dto/delete-escola.dto.js';
import { UpdateEscolaDto } from './dto/update-escola.dto.js';
import { EscolaService } from './escola.service.js';

@Controller('escola')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EscolaController {
  constructor(private readonly escola: EscolaService) {}

  /** Só o nome, para a tela de login (sem autenticação). */
  @Public()
  @Get('publica')
  nomePublico() {
    return this.escola.nomePublico();
  }

  @Get()
  obter(@CurrentUser() user: AuthUser) {
    return this.escola.obter(user);
  }

  @Put()
  @Roles('DIRETORA')
  atualizar(@CurrentUser() user: AuthUser, @Body() dto: UpdateEscolaDto) {
    return this.escola.atualizar(user, dto);
  }

  /**
   * Apaga a escola e todo o histórico. Exige a senha da diretora no corpo
   * (reautenticação). Limite apertado — é destrutivo e a senha vai no body.
   */
  @Delete()
  @Roles('DIRETORA')
  @RateLimit({ ttl: 60, limit: 5 })
  @HttpCode(204)
  excluir(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteEscolaDto,
  ): Promise<void> {
    return this.escola.excluir(user, dto.senha);
  }
}
