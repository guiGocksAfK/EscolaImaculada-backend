import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  registroChamada: { select: { turmaId: true } },
  aluno: { select: { id: true, nome: true } },
} as const;

// Mantém aluno.turmaId para clientes antigos, com a turma histórica da falta.
function resposta(f: {
  id: string;
  alunoId: string;
  data: string;
  motivo: string;
  registroChamada: { turmaId: string };
  aluno: { id: string; nome: string };
}) {
  const { registroChamada, ...dados } = f;
  return {
    ...dados,
    turmaId: registroChamada.turmaId,
    aluno: { ...dados.aluno, turmaId: registroChamada.turmaId },
  };
}

@Injectable()
export class FaltasJustificadasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async listar(user: AuthUser, query: ListarFaltasQueryDto) {
    const permitidas = await this.acesso.turmaIdsDoUsuario(user);
    if (query.turmaId) await this.acesso.assertAcessoTurma(user, query.turmaId);
    const faltas = await this.prisma.faltaJustificada.findMany({
      where: {
        registroChamada: { turmaId: query.turmaId ?? { in: permitidas } },
        ...(query.alunoId ? { alunoId: query.alunoId } : {}),
      },
      select: selectFalta,
      orderBy: { data: 'desc' },
    });
    return faltas.map(resposta);
  }

  async criar(user: AuthUser, dto: FaltaJustificadaDto) {
    const registro = await this.faltaAutorizada(user, dto);
    return resposta(
      await this.prisma.faltaJustificada.create({
        data: {
          alunoId: registro.alunoId,
          data: registro.data,
          registroChamadaId: registro.id,
          motivo: dto.motivo.trim(),
        },
        select: selectFalta,
      }),
    );
  }

  async atualizar(user: AuthUser, id: string, dto: FaltaJustificadaDto) {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.registroChamada.turmaId);
    const registro = await this.faltaAutorizada(user, {
      ...dto,
      turmaId: dto.turmaId ?? atual.registroChamada.turmaId,
    });
    return resposta(
      await this.prisma.faltaJustificada.update({
        where: { id },
        data: {
          alunoId: registro.alunoId,
          data: registro.data,
          registroChamadaId: registro.id,
          motivo: dto.motivo.trim(),
        },
        select: selectFalta,
      }),
    );
  }

  async remover(user: AuthUser, id: string): Promise<void> {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.registroChamada.turmaId);
    await this.prisma.faltaJustificada.delete({ where: { id } });
  }

  private async buscar(id: string) {
    const falta = await this.prisma.faltaJustificada.findUnique({
      where: { id },
      select: { registroChamada: { select: { turmaId: true } } },
    });
    if (!falta) throw new NotFoundException('Registro não encontrado');
    return falta;
  }

  private async faltaAutorizada(user: AuthUser, dto: FaltaJustificadaDto) {
    const permitidas = await this.acesso.turmaIdsDoUsuario(user);
    if (dto.turmaId) await this.acesso.assertAcessoTurma(user, dto.turmaId);
    const registros = await this.prisma.registroChamada.findMany({
      where: {
        alunoId: dto.alunoId,
        data: dto.data,
        status: 'F',
        turmaId: dto.turmaId ?? { in: permitidas },
      },
      select: { id: true, alunoId: true, data: true },
      take: 2,
    });
    if (registros.length !== 1)
      throw new BadRequestException(
        'Informe a turma de uma falta existente no seu acesso.',
      );
    return registros[0];
  }
}
