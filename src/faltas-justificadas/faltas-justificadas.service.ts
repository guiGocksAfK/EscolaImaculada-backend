import { Injectable, NotFoundException } from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FaltaJustificadaDto,
  ListarFaltasQueryDto,
} from './dto/falta-justificada.dto.js';

const selectFalta = {
  id: true,
  alunoId: true,
  data: true,
  motivo: true,
  aluno: { select: { id: true, nome: true, turmaId: true } },
} as const;

@Injectable()
export class FaltasJustificadasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async listar(user: AuthUser, query: ListarFaltasQueryDto) {
    const permitidas = await this.acesso.turmaIdsDoUsuario(user);
    const turmaFiltro =
      query.turmaId && permitidas.includes(query.turmaId)
        ? query.turmaId
        : undefined;

    return this.prisma.faltaJustificada.findMany({
      where: {
        aluno: {
          turmaId: turmaFiltro ? turmaFiltro : { in: permitidas },
        },
        ...(query.alunoId ? { alunoId: query.alunoId } : {}),
      },
      select: selectFalta,
      orderBy: { data: 'desc' },
    });
  }

  async criar(user: AuthUser, dto: FaltaJustificadaDto) {
    await this.assertAcesso(user, dto.alunoId);
    return this.prisma.faltaJustificada.create({
      data: {
        alunoId: dto.alunoId,
        data: dto.data,
        motivo: dto.motivo.trim(),
      },
      select: selectFalta,
    });
  }

  async atualizar(user: AuthUser, id: string, dto: FaltaJustificadaDto) {
    const atual = await this.buscar(id);
    await this.assertAcesso(user, atual.alunoId);
    await this.assertAcesso(user, dto.alunoId);
    return this.prisma.faltaJustificada.update({
      where: { id },
      data: {
        alunoId: dto.alunoId,
        data: dto.data,
        motivo: dto.motivo.trim(),
      },
      select: selectFalta,
    });
  }

  async remover(user: AuthUser, id: string): Promise<void> {
    const atual = await this.buscar(id);
    await this.assertAcesso(user, atual.alunoId);
    await this.prisma.faltaJustificada.delete({ where: { id } });
  }

  private async buscar(id: string) {
    const falta = await this.prisma.faltaJustificada.findUnique({
      where: { id },
      select: { id: true, alunoId: true },
    });
    if (!falta) {
      throw new NotFoundException('Registro não encontrado');
    }
    return falta;
  }

  private async assertAcesso(user: AuthUser, alunoId: string): Promise<void> {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      select: { turmaId: true },
    });
    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado');
    }
    await this.acesso.assertAcessoTurma(user, aluno.turmaId);
  }
}
