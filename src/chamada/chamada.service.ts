import { Injectable } from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
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
    const registros = await this.prisma.registroChamada.findMany({
      where: { turmaId: query.turmaId, data: query.data },
      select: { alunoId: true, status: true },
    });
    return { turmaId: query.turmaId, data: query.data, registros };
  }

  async salvarDia(
    user: AuthUser,
    dto: SalvarChamadaDiaDto,
  ): Promise<ChamadaDia> {
    await this.acesso.assertAcessoTurma(user, dto.turmaId);

    await this.prisma.$transaction([
      this.prisma.registroChamada.deleteMany({
        where: { turmaId: dto.turmaId, data: dto.data },
      }),
      this.prisma.registroChamada.createMany({
        data: dto.registros.map((r) => ({
          turmaId: dto.turmaId,
          data: dto.data,
          alunoId: r.alunoId,
          status: r.status,
        })),
      }),
    ]);

    return {
      turmaId: dto.turmaId,
      data: dto.data,
      registros: dto.registros.map((r) => ({
        alunoId: r.alunoId,
        status: r.status,
      })),
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

    const dias = [...new Set(registros.map((r) => r.data))].sort();

    const alunos = await this.prisma.aluno.findMany({
      where: { turmaId: query.turmaId, status: 'ATIVO' },
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
