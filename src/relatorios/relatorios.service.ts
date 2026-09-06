import { Injectable, NotFoundException } from '@nestjs/common';

import { ChamadaService } from '../chamada/chamada.service.js';
import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { mesesDoSemestre } from '../common/semestre.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistroSemestralQueryDto } from './dto/registro-semestral-query.dto.js';
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
    private readonly chamada: ChamadaService,
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
        // Avaliação não tem data estruturada — filtra pelo ano citado na
        // referência (ex.: "1º semestre 2026"), senão o resumo de um ano
        // traz avaliações de todos os anos da turma.
        where: {
          turmaId: query.turmaId,
          referencia: { contains: `${query.ano}` },
        },
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

  /**
   * Monta o registro de classe do semestre inteiro — frequência mês a mês,
   * conteúdo, faltas justificadas, avaliações e o resumo — já filtrado pelo
   * período. Antes isso era montado no front com ~5 chamadas + filtros.
   */
  async registroSemestral(user: AuthUser, query: RegistroSemestralQueryDto) {
    await this.acesso.assertAcessoTurma(user, query.turmaId);

    const turma = await this.prisma.turma.findUnique({
      where: { id: query.turmaId },
      select: { nome: true },
    });
    if (!turma) {
      throw new NotFoundException('Turma não encontrada');
    }

    const meses = mesesDoSemestre(query.semestre);
    const prefixos = meses.map(
      (m) => `${query.ano}-${String(m).padStart(2, '0')}`,
    );
    const noPeriodo = { OR: prefixos.map((p) => ({ data: { startsWith: p } })) };

    const [grades, alunos, conteudos, justificadas, avaliacoes] =
      await Promise.all([
        Promise.all(
          meses.map((mes) =>
            this.chamada.getMes(user, {
              turmaId: query.turmaId,
              ano: query.ano,
              mes,
            }),
          ),
        ),
        this.prisma.aluno.findMany({
          where: { turmaId: query.turmaId },
          select: { id: true, nome: true, status: true, dataNascimento: true },
          orderBy: { nome: 'asc' },
        }),
        this.prisma.registroConteudo.findMany({
          where: { turmaId: query.turmaId, ...noPeriodo },
          select: { id: true, data: true, conteudo: true },
          orderBy: { data: 'asc' },
        }),
        this.prisma.faltaJustificada.findMany({
          where: { aluno: { turmaId: query.turmaId }, ...noPeriodo },
          select: {
            alunoId: true,
            data: true,
            motivo: true,
            aluno: { select: { nome: true } },
          },
          orderBy: { data: 'asc' },
        }),
        this.prisma.avaliacao.findMany({
          where: {
            turmaId: query.turmaId,
            referencia: { contains: `${query.ano}` },
          },
          select: {
            alunoId: true,
            referencia: true,
            texto: true,
            aluno: { select: { nome: true } },
          },
        }),
      ]);

    const mesesComChamada = grades.filter((g) => g.dias.length > 0);
    const atendimentos = mesesComChamada.reduce(
      (soma, g) => soma + g.dias.length,
      0,
    );
    const faltasPorAluno: Record<string, number> = {};
    for (const g of mesesComChamada) {
      for (const linha of g.linhas) {
        faltasPorAluno[linha.alunoId] =
          (faltasPorAluno[linha.alunoId] ?? 0) + linha.totalFaltas;
      }
    }

    return {
      turmaId: query.turmaId,
      turmaNome: turma.nome,
      ano: query.ano,
      semestre: query.semestre,
      responsavelNome: user.nome,
      meses: grades,
      alunos,
      conteudos,
      justificadas,
      avaliacoes,
      atendimentos,
      faltasPorAluno,
    };
  }
}
