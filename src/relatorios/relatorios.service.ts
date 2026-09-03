import { Injectable, NotFoundException } from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResumoQueryDto } from './dto/resumo-query.dto.js';

interface ResumoAluno {
  alunoId: string;
  alunoNome: string;
  presencas: number;
  faltas: number;
  faltasJustificadas: number;
  avaliacoes: Array<{ referencia: string; texto: string }>;
}

interface RelatorioResumo {
  turmaId: string;
  turmaNome: string;
  ano: number;
  diasLancados: number;
  linhas: ResumoAluno[];
}

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async resumoPorAluno(
    user: AuthUser,
    query: ResumoQueryDto,
  ): Promise<RelatorioResumo> {
    await this.acesso.assertAcessoTurma(user, query.turmaId);

    const turma = await this.prisma.turma.findUnique({
      where: { id: query.turmaId },
      select: { nome: true },
    });
    if (!turma) {
      throw new NotFoundException('Turma não encontrada');
    }

    const prefixoAno = `${query.ano}-`;

    const [chamada, alunos, avaliacoes] = await Promise.all([
      this.prisma.registroChamada.findMany({
        where: { turmaId: query.turmaId, data: { startsWith: prefixoAno } },
        select: { alunoId: true, data: true, status: true },
      }),
      this.prisma.aluno.findMany({
        where: { turmaId: query.turmaId, status: 'ATIVO' },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.avaliacao.findMany({
        where: { turmaId: query.turmaId },
        select: { alunoId: true, referencia: true, texto: true },
      }),
    ]);

    const alunoIds = alunos.map((a) => a.id);
    const faltasJust = await this.prisma.faltaJustificada.findMany({
      where: {
        alunoId: { in: alunoIds },
        data: { startsWith: prefixoAno },
      },
      select: { alunoId: true },
    });

    const diasLancados = new Set(chamada.map((r) => r.data)).size;

    const linhas: ResumoAluno[] = alunos.map((al) => {
      const dele = chamada.filter((r) => r.alunoId === al.id);
      return {
        alunoId: al.id,
        alunoNome: al.nome,
        presencas: dele.filter((r) => r.status === 'C').length,
        faltas: dele.filter((r) => r.status === 'F').length,
        faltasJustificadas: faltasJust.filter((f) => f.alunoId === al.id).length,
        avaliacoes: avaliacoes
          .filter((a) => a.alunoId === al.id)
          .map((a) => ({ referencia: a.referencia, texto: a.texto })),
      };
    });

    return {
      turmaId: query.turmaId,
      turmaNome: turma.nome,
      ano: query.ano,
      diasLancados,
      linhas,
    };
  }
}
