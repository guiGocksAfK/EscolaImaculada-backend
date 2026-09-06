import { Injectable, NotFoundException } from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { mascararCpf } from '../common/validators.js';
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

/** CPF nunca sai inteiro da API — só os 2 últimos dígitos. */
function comCpfMascarado<T extends { cpf: string }>(aluno: T): T {
  return { ...aluno, cpf: mascararCpf(aluno.cpf) };
}

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

    const lista = await this.prisma.aluno.findMany({
      where: {
        turmaId: turmaId ? turmaId : { in: permitidas },
        ...(query.status ? { status: query.status } : {}),
      },
      select: selectAluno,
      orderBy: { nome: 'asc' },
    });
    return lista.map(comCpfMascarado);
  }

  async criar(user: AuthUser, dto: CreateAlunoDto) {
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    const criado = await this.prisma.aluno.create({
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
    return comCpfMascarado(criado);
  }

  async atualizar(user: AuthUser, id: string, dto: UpdateAlunoDto) {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    const atualizado = await this.prisma.aluno.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        // CPF só muda quando um novo é enviado (o front recebe mascarado).
        ...(dto.cpf ? { cpf: dto.cpf.trim() } : {}),
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
    return comCpfMascarado(atualizado);
  }

  async alterarStatus(user: AuthUser, id: string, status: StatusAluno) {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    const atualizado = await this.prisma.aluno.update({
      where: { id },
      data: { status },
      select: selectAluno,
    });
    return comCpfMascarado(atualizado);
  }

  async remover(user: AuthUser, id: string): Promise<void> {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
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
