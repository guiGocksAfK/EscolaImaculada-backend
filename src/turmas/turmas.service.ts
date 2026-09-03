import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TurmaDto } from './dto/turma.dto.js';

const selectTurma = {
  id: true,
  nome: true,
  periodo: true,
  anoLetivo: true,
  professoraId: true,
  escolaId: true,
  professora: { select: { id: true, nome: true } },
} as const;

@Injectable()
export class TurmasService {
  constructor(private readonly prisma: PrismaService) {}

  listar(user: AuthUser) {
    const where =
      user.papel === 'DIRETORA'
        ? { escolaId: user.escolaId }
        : { professoraId: user.id };
    return this.prisma.turma.findMany({
      where,
      select: selectTurma,
      orderBy: [{ anoLetivo: 'desc' }, { nome: 'asc' }],
    });
  }

  async criar(user: AuthUser, dto: TurmaDto) {
    await this.assertProfessoraDaEscola(user, dto.professoraId);
    return this.prisma.turma.create({
      data: {
        nome: dto.nome.trim(),
        periodo: dto.periodo,
        anoLetivo: dto.anoLetivo,
        professoraId: dto.professoraId,
        escolaId: user.escolaId,
      },
      select: selectTurma,
    });
  }

  async atualizar(user: AuthUser, id: string, dto: TurmaDto) {
    await this.buscarNaEscola(user, id);
    await this.assertProfessoraDaEscola(user, dto.professoraId);
    return this.prisma.turma.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        periodo: dto.periodo,
        anoLetivo: dto.anoLetivo,
        professoraId: dto.professoraId,
      },
      select: selectTurma,
    });
  }

  async remover(user: AuthUser, id: string): Promise<void> {
    await this.buscarNaEscola(user, id);
    const alunos = await this.prisma.aluno.count({ where: { turmaId: id } });
    if (alunos > 0) {
      throw new ConflictException(
        'Turma tem alunos vinculados. Mova ou remova os alunos antes de excluir.',
      );
    }
    await this.prisma.turma.delete({ where: { id } });
  }

  private async buscarNaEscola(user: AuthUser, id: string) {
    const turma = await this.prisma.turma.findFirst({
      where: { id, escolaId: user.escolaId },
      select: { id: true },
    });
    if (!turma) {
      throw new NotFoundException('Turma não encontrada');
    }
    return turma;
  }

  private async assertProfessoraDaEscola(
    user: AuthUser,
    professoraId: string,
  ): Promise<void> {
    const professora = await this.prisma.usuario.findFirst({
      where: {
        id: professoraId,
        escolaId: user.escolaId,
        papel: 'PROFESSORA',
      },
      select: { id: true },
    });
    if (!professora) {
      throw new BadRequestException('Professora inválida para esta escola');
    }
  }
}
