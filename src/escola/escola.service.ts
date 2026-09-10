import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';

import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateEscolaDto } from './dto/update-escola.dto.js';

const escolaPublica = { id: true, nome: true, endereco: true } as const;

@Injectable()
export class EscolaService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(user: AuthUser) {
    const escola = await this.prisma.escola.findUnique({
      where: { id: user.escolaId },
      select: escolaPublica,
    });
    if (!escola) {
      throw new NotFoundException('Escola não encontrada');
    }
    return escola;
  }

  /**
   * Só o nome da escola, para as telas de antes do login (sem token). Não
   * expõe nada sensível. Só responde quando a instância tem exatamente uma
   * escola — numa instalação multi-escola não há como saber qual mostrar.
   */
  async nomePublico(): Promise<{ nome: string | null }> {
    const total = await this.prisma.escola.count();
    if (total !== 1) {
      return { nome: null };
    }
    const escola = await this.prisma.escola.findFirst({
      select: { nome: true },
    });
    return { nome: escola?.nome ?? null };
  }

  async atualizar(user: AuthUser, dto: UpdateEscolaDto) {
    await this.obter(user);
    return this.prisma.escola.update({
      where: { id: user.escolaId },
      data: { nome: dto.nome.trim(), endereco: dto.endereco.trim() },
      select: escolaPublica,
    });
  }

  /**
   * Apaga a escola e TUDO que pende dela (turmas, alunos, chamadas,
   * conteúdos, avaliações, faltas, contas e a trilha de auditoria).
   * Irreversível — por isso exige a senha da diretora de novo.
   */
  async excluir(user: AuthUser, senha: string): Promise<void> {
    const diretora = await this.prisma.usuario.findUnique({
      where: { id: user.id },
      select: { senhaHash: true },
    });
    if (!diretora || !(await bcrypt.compare(senha, diretora.senhaHash))) {
      throw new UnauthorizedException('Senha incorreta');
    }

    const escolaId = user.escolaId;

    await this.prisma.$transaction(async (tx) => {
      // Alunos primeiro: cascateia chamadas, avaliações e faltas justificadas.
      await tx.aluno.deleteMany({ where: { turma: { escolaId } } });
      // Turmas: cascateia registros de conteúdo (e o que sobrar por turma).
      await tx.turma.deleteMany({ where: { escolaId } });
      // Contas (diretora + professoras) da escola.
      await tx.usuario.deleteMany({ where: { escolaId } });
      // Trilha de auditoria (não tem FK, mas não faz sentido manter órfã).
      await tx.registroAuditoria.deleteMany({ where: { escolaId } });
      // E a escola.
      await tx.escola.delete({ where: { id: escolaId } });
    });
  }
}
