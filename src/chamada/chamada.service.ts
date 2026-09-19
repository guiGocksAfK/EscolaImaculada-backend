import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { hojeISO } from '../common/validators.js';
import {
  bloquearTurmas,
  matriculaNaData,
  alunosNoPeriodo,
} from '../common/historico.js';
import { StatusDia } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ChamadaDiaQueryDto,
  ChamadaMensalQueryDto,
  SalvarChamadaDiaDto,
} from './dto/chamada.dto.js';

interface ChamadaDia {
  turmaId: string;
  data: string;
  registros: Array<{ alunoId: string; status: StatusDia }>;
  lancada?: boolean;
  alunos?: Array<{ id: string; nome: string }>;
}

interface ChamadaMensal {
  turmaId: string;
  ano: number;
  mes: number;
  dias: string[];
  linhas: Array<{
    alunoId: string;
    alunoNome: string;
    porDia: Record<string, StatusDia | null>;
    totalFaltas: number;
  }>;
}

@Injectable()
export class ChamadaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async getDia(user: AuthUser, query: ChamadaDiaQueryDto): Promise<ChamadaDia> {
    await this.acesso.assertAcessoTurma(user, query.turmaId);
    const dia = await this.prisma.diaChamada.findUnique({
      where: { turmaId_data: { turmaId: query.turmaId, data: query.data } },
      include: {
        registros: {
          select: {
            alunoId: true,
            status: true,
            aluno: { select: { id: true, nome: true } },
          },
        },
      },
    });
    const alunos = dia
      ? dia.registros.map((r) => r.aluno)
      : await this.prisma.aluno.findMany({
          where: {
            matriculas: { some: matriculaNaData(query.turmaId, query.data) },
          },
          select: { id: true, nome: true },
          orderBy: { nome: 'asc' },
        });
    return {
      turmaId: query.turmaId,
      data: query.data,
      lancada: !!dia,
      alunos: alunos.sort((a, b) => a.nome.localeCompare(b.nome)),
      registros:
        dia?.registros.map(({ alunoId, status }) => ({ alunoId, status })) ??
        [],
    };
  }

  async salvarDia(
    user: AuthUser,
    dto: SalvarChamadaDiaDto,
  ): Promise<ChamadaDia> {
    await this.acesso.assertAcessoTurma(user, dto.turmaId);

    // Pode lançar hoje ou qualquer dia anterior (ex.: esqueceu de lançar
    // ontem) — nunca um dia que ainda não chegou. Comparação de string
    // funciona porque a data é sempre ISO (YYYY-MM-DD).
    if (dto.data > hojeISO()) {
      throw new ForbiddenException(
        'Não é possível lançar chamada de um dia que ainda não chegou',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await bloquearTurmas(tx, [dto.turmaId]);
      const existente = await tx.diaChamada.findUnique({
        where: { turmaId_data: { turmaId: dto.turmaId, data: dto.data } },
      });
      if (existente)
        throw new ConflictException(
          'A chamada deste dia já foi lançada e não pode ser reeditada',
        );
      const esperados = await tx.aluno.findMany({
        where: { matriculas: { some: matriculaNaData(dto.turmaId, dto.data) } },
        select: { id: true },
      });
      const enviados = new Set(dto.registros.map((r) => r.alunoId));
      if (
        !esperados.length ||
        enviados.size !== dto.registros.length ||
        enviados.size !== esperados.length ||
        esperados.some((a) => !enviados.has(a.id))
      ) {
        throw new BadRequestException(
          'Envie exatamente uma marcação para cada aluno matriculado na data. Recarregue a chamada.',
        );
      }
      await tx.diaChamada.create({
        data: { turmaId: dto.turmaId, data: dto.data },
      });
      await tx.registroChamada.createMany({
        data: dto.registros.map((r) => ({
          ...r,
          turmaId: dto.turmaId,
          data: dto.data,
        })),
      });
    });
    return {
      turmaId: dto.turmaId,
      data: dto.data,
      registros: dto.registros,
      lancada: true,
    };
  }

  async getMes(
    user: AuthUser,
    query: ChamadaMensalQueryDto,
  ): Promise<ChamadaMensal> {
    await this.acesso.assertAcessoTurma(user, query.turmaId);

    const prefixo = `${query.ano}-${String(query.mes).padStart(2, '0')}`;
    const registros = await this.prisma.registroChamada.findMany({
      where: { turmaId: query.turmaId, data: { startsWith: prefixo } },
      select: { alunoId: true, data: true, status: true },
    });

    const dias = (
      await this.prisma.diaChamada.findMany({
        where: { turmaId: query.turmaId, data: { startsWith: prefixo } },
        select: { data: true },
        orderBy: { data: 'asc' },
      })
    ).map((d) => d.data);
    const inicio = prefixo + '-01';
    const fim =
      query.mes === 12
        ? query.ano + 1 + '-01-01'
        : query.ano + '-' + String(query.mes + 1).padStart(2, '0') + '-01';

    const alunos = await this.prisma.aluno.findMany({
      where: alunosNoPeriodo(query.turmaId, inicio, fim),
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });

    const linhas = alunos.map((a) => {
      const porDia: Record<string, StatusDia | null> = {};
      let totalFaltas = 0;
      for (const d of dias) {
        const r = registros.find((x) => x.alunoId === a.id && x.data === d);
        porDia[d] = r ? r.status : null;
        if (r?.status === 'F') {
          totalFaltas++;
        }
      }
      return { alunoId: a.id, alunoNome: a.nome, porDia, totalFaltas };
    });

    return {
      turmaId: query.turmaId,
      ano: query.ano,
      mes: query.mes,
      dias,
      linhas,
    };
  }
}
