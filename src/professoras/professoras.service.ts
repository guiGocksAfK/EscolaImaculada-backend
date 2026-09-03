import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';

import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateProfessoraDto,
  UpdateProfessoraDto,
} from './dto/professora.dto.js';

const SALT_ROUNDS = 10;

interface ProfessoraDetalhe {
  id: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  totalTurmas: number;
}

const selectDetalhe = {
  id: true,
  nome: true,
  cpf: true,
  dataNascimento: true,
  _count: { select: { turmas: true } },
} as const;

type LinhaComContagem = {
  id: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  _count: { turmas: number };
};

function toDetalhe(u: LinhaComContagem): ProfessoraDetalhe {
  const { _count, ...rest } = u;
  return { ...rest, totalTurmas: _count.turmas };
}

@Injectable()
export class ProfessorasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(user: AuthUser): Promise<ProfessoraDetalhe[]> {
    const linhas = await this.prisma.usuario.findMany({
      where: { escolaId: user.escolaId, papel: 'PROFESSORA' },
      select: selectDetalhe,
      orderBy: { nome: 'asc' },
    });
    return linhas.map(toDetalhe);
  }

  async criar(
    user: AuthUser,
    dto: CreateProfessoraDto,
  ): Promise<ProfessoraDetalhe> {
    await this.assertCpfLivre(dto.cpf);
    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    const criada = await this.prisma.usuario.create({
      data: {
        nome: dto.nome.trim(),
        cpf: dto.cpf,
        dataNascimento: dto.dataNascimento,
        senhaHash,
        papel: 'PROFESSORA',
        escolaId: user.escolaId,
      },
      select: selectDetalhe,
    });
    return toDetalhe(criada);
  }

  async atualizar(
    user: AuthUser,
    id: string,
    dto: UpdateProfessoraDto,
  ): Promise<ProfessoraDetalhe> {
    await this.buscarNaEscola(user, id);
    await this.assertCpfLivre(dto.cpf, id);

    const senhaHash = dto.senha
      ? await bcrypt.hash(dto.senha, SALT_ROUNDS)
      : undefined;

    const atualizada = await this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        cpf: dto.cpf,
        dataNascimento: dto.dataNascimento,
        ...(senhaHash ? { senhaHash } : {}),
      },
      select: selectDetalhe,
    });
    return toDetalhe(atualizada);
  }

  async remover(user: AuthUser, id: string): Promise<void> {
    const professora = await this.buscarNaEscola(user, id);
    if (professora._count.turmas > 0) {
      throw new ConflictException(
        'Professora tem turmas vinculadas. Reatribua as turmas antes de excluir.',
      );
    }
    await this.prisma.usuario.delete({ where: { id } });
  }

  private async buscarNaEscola(
    user: AuthUser,
    id: string,
  ): Promise<LinhaComContagem> {
    const professora = await this.prisma.usuario.findFirst({
      where: { id, escolaId: user.escolaId, papel: 'PROFESSORA' },
      select: selectDetalhe,
    });
    if (!professora) {
      throw new NotFoundException('Professora não encontrada');
    }
    return professora;
  }

  private async assertCpfLivre(cpf: string, ignorarId?: string): Promise<void> {
    const existente = await this.prisma.usuario.findUnique({
      where: { cpf },
      select: { id: true },
    });
    if (existente && existente.id !== ignorarId) {
      throw new ConflictException('Já existe usuário com esse CPF');
    }
  }
}
