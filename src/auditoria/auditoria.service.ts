import { Injectable, Logger } from '@nestjs/common';

import type { AuthUser } from '../common/auth-user.js';
import { Papel } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListarAuditoriaDto } from './dto/listar-auditoria.dto.js';

export interface RegistrarAuditoria {
  usuarioId: string;
  usuarioNome: string;
  papel: Papel;
  escolaId: string;
  metodo: string;
  rota: string;
  caminho: string;
  statusCode: number;
  ip: string | null;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava um registro de auditoria. É "fire-and-forget": uma falha aqui
   * nunca deve derrubar a requisição que está sendo auditada.
   */
  registrar(dados: RegistrarAuditoria): void {
    this.prisma.registroAuditoria.create({ data: dados }).catch((err: unknown) => {
      this.logger.error(`Falha ao gravar auditoria: ${String(err)}`);
    });
  }

  listar(user: AuthUser, query: ListarAuditoriaDto) {
    const take = Math.min(query.limite ?? 100, 500);
    return this.prisma.registroAuditoria.findMany({
      where: {
        escolaId: user.escolaId,
        ...(query.usuarioId ? { usuarioId: query.usuarioId } : {}),
        ...(query.metodo ? { metodo: query.metodo } : {}),
      },
      orderBy: { criadoEm: 'desc' },
      take,
    });
  }
}
