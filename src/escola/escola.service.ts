import { Injectable, NotFoundException } from '@nestjs/common';

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

  async atualizar(user: AuthUser, dto: UpdateEscolaDto) {
    await this.obter(user);
    return this.prisma.escola.update({
      where: { id: user.escolaId },
      data: { nome: dto.nome.trim(), endereco: dto.endereco.trim() },
      select: escolaPublica,
    });
  }
}
