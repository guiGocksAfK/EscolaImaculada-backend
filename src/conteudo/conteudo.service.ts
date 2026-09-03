import { Injectable, NotFoundException } from '@nestjs/common';

import { AcessoService } from '../common/acesso.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ConteudoDto,
  ListarConteudoQueryDto,
} from './dto/conteudo.dto.js';

const selectConteudo = {
  id: true,
  turmaId: true,
  data: true,
  conteudo: true,
  turma: { select: { id: true, nome: true } },
} as const;

@Injectable()
export class ConteudoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  async listar(user: AuthUser, query: ListarConteudoQueryDto) {
    const permitidas = await this.acesso.turmaIdsDoUsuario(user);
    const turmaId =
      query.turmaId && permitidas.includes(query.turmaId)
        ? query.turmaId
        : undefined;
    return this.prisma.registroConteudo.findMany({
      where: { turmaId: turmaId ? turmaId : { in: permitidas } },
      select: selectConteudo,
      orderBy: { data: 'desc' },
    });
  }

  async criar(user: AuthUser, dto: ConteudoDto) {
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    return this.prisma.registroConteudo.create({
      data: {
        turmaId: dto.turmaId,
        data: dto.data,
        conteudo: dto.conteudo.trim(),
      },
      select: selectConteudo,
    });
  }

  async atualizar(user: AuthUser, id: string, dto: ConteudoDto) {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    await this.acesso.assertAcessoTurma(user, dto.turmaId);
    return this.prisma.registroConteudo.update({
      where: { id },
      data: {
        turmaId: dto.turmaId,
        data: dto.data,
        conteudo: dto.conteudo.trim(),
      },
      select: selectConteudo,
    });
  }

  async remover(user: AuthUser, id: string): Promise<void> {
    const atual = await this.buscar(id);
    await this.acesso.assertAcessoTurma(user, atual.turmaId);
    await this.prisma.registroConteudo.delete({ where: { id } });
  }

  private async buscar(id: string) {
    const registro = await this.prisma.registroConteudo.findUnique({
      where: { id },
      select: { id: true, turmaId: true },
    });
    if (!registro) {
      throw new NotFoundException('Registro não encontrado');
    }
    return registro;
  }
}
