import { Injectable, NotFoundException } from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateAlunoDto,
  ListarAlunosQueryDto,
  UpdateAlunoDto,
} from './dto/aluno.dto.js';
import { StatusAluno } from '../generated/prisma/client.js';

const selectAluno = {
  id: true,
  nome: true,
  cpf: true,
  dataNascimento: true,
  nomePai: true,
  nomeMae: true,
  localNascimento: true,
  endereco: true,
  status: true,
  turmaId: true,
  turma: { select: { id: true, nome: true } },
} as const;

@Injectable()
export class AlunosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async listar(user: AuthUser, query: ListarAlunosQueryDto) {
    const permitidas = await this.acesso.turmaIdsDoUsuario(user);
    const turmaId =
      query.turmaId && permitidas.includes(query.turmaId)
        ? query.turmaId
        : undefined;

    return this.prisma.aluno.findMany({
      where: {
        turmaId: turmaId ? turmaId : { in: permitidas },
        ...(query.status ? { status: query.status } : {}),
      },
      select: selectAluno,
      orderBy: { nome: 'asc' },
    });
  }

  async criar(user: AuthUser, dto: CreateAlunoDto) {
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    return this.prisma.aluno.create({
      data: {
        nome: dto.nome.trim(),
        cpf: dto.cpf.trim(),
        dataNascimento: dto.dataNascimento,
        nomePai: dto.nomePai.trim(),
        nomeMae: dto.nomeMae.trim(),
        localNascimento: dto.localNascimento.trim(),
        endereco: dto.endereco.trim(),
        turmaId: dto.turmaId,
        status: 'ATIVO',
      },
      select: selectAluno,
    });
  }

  async atualizar(user: AuthUser, id: string, dto: UpdateAlunoDto) {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    return this.prisma.aluno.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        cpf: dto.cpf.trim(),
        dataNascimento: dto.dataNascimento,
        nomePai: dto.nomePai.trim(),
        nomeMae: dto.nomeMae.trim(),
        localNascimento: dto.localNascimento.trim(),
        endereco: dto.endereco.trim(),
        turmaId: dto.turmaId,
        status: dto.status,
      },
      select: selectAluno,
    });
  }

  async alterarStatus(user: AuthUser, id: string, status: StatusAluno) {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    return this.prisma.aluno.update({
      where: { id },
      data: { status },
      select: selectAluno,
    });
  }

  async remover(id: string): Promise<void> {
    await this.buscar(id);
    await this.prisma.aluno.delete({ where: { id } });
  }

  private async buscar(id: string) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id },
      select: { id: true, turmaId: true },
    });
    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado');
    }
    return aluno;
  }
}
