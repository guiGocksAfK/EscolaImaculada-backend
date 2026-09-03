import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AvaliacaoDto,
  ListarAvaliacoesQueryDto,
} from './dto/avaliacao.dto.js';

const selectAvaliacao = {
  id: true,
  alunoId: true,
  turmaId: true,
  texto: true,
  referencia: true,
  aluno: { select: { id: true, nome: true } },
  turma: { select: { id: true, nome: true } },
} as const;

@Injectable()
export class AvaliacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async listar(user: AuthUser, query: ListarAvaliacoesQueryDto) {
    const permitidas = await this.acesso.turmaIdsDoUsuario(user);
    const turmaId =
      query.turmaId && permitidas.includes(query.turmaId)
        ? query.turmaId
        : undefined;
    return this.prisma.avaliacao.findMany({
      where: {
        turmaId: turmaId ? turmaId : { in: permitidas },
        ...(query.alunoId ? { alunoId: query.alunoId } : {}),
      },
      select: selectAvaliacao,
      orderBy: [{ referencia: 'desc' }, { aluno: { nome: 'asc' } }],
    });
  }

  async criar(user: AuthUser, dto: AvaliacaoDto) {
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    await this.assertAlunoNaTurma(dto.alunoId, dto.turmaId);
    return this.prisma.avaliacao.create({
      data: {
        alunoId: dto.alunoId,
        turmaId: dto.turmaId,
        texto: dto.texto.trim(),
        referencia: dto.referencia.trim(),
      },
      select: selectAvaliacao,
    });
  }

  async atualizar(user: AuthUser, id: string, dto: AvaliacaoDto) {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    await this.assertAlunoNaTurma(dto.alunoId, dto.turmaId);
    return this.prisma.avaliacao.update({
      where: { id },
      data: {
        alunoId: dto.alunoId,
        turmaId: dto.turmaId,
        texto: dto.texto.trim(),
        referencia: dto.referencia.trim(),
      },
      select: selectAvaliacao,
    });
  }

  async remover(user: AuthUser, id: string): Promise<void> {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    await this.prisma.avaliacao.delete({ where: { id } });
  }

  private async buscar(id: string) {
    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id },
      select: { id: true, turmaId: true },
    });
    if (!avaliacao) {
      throw new NotFoundException('Avaliação não encontrada');
    }
    return avaliacao;
  }

  private async assertAlunoNaTurma(
    alunoId: string,
    turmaId: string,
  ): Promise<void> {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      select: { turmaId: true },
    });
    if (!aluno || aluno.turmaId !== turmaId) {
      throw new BadRequestException('Aluno não pertence à turma informada');
    }
  }
}
