import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

/**
 * Escopo de acesso a turmas por papel:
 * - DIRETORA: todas as turmas da escola dela.
 * - PROFESSORA: apenas as turmas em que é responsável.
 */
@Injectable()
export class AcessoService {
  constructor(private readonly prisma: PrismaService) {}

  async turmaIdsDoUsuario(user: AuthUser): Promise<string[]> {
    const where =
      user.papel === 'DIRETORA'
        ? { escolaId: user.escolaId }
        : { professoraId: user.id };
    const turmas = await this.prisma.turma.findMany({
      where,
      select: { id: true },
    });
    return turmas.map((t) => t.id);
  }

  async assertAcessoTurma(user: AuthUser, turmaId: string): Promise<void> {
    const ids = await this.turmaIdsDoUsuario(user);
    if (!ids.includes(turmaId)) {
      throw new ForbiddenException('Turma fora do seu acesso');
    }
  }

  async assertAcessoAluno(user: AuthUser, alunoId: string): Promise<void> {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      select: { turmaId: true },
    });
    if (!aluno) {
      return; // deixa o 404 para a camada de serviço
    }
    await this.assertAcessoTurma(user, aluno.turmaId);
  }
}
