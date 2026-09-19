import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../common/auth-user.js';
import { AuditoriaService } from './auditoria.service.js';

const ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditoriaMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditoriaMiddleware.name);

  constructor(private readonly auditoria: AuditoriaService) {}

  use(
    req: Request & { user?: AuthUser },
    res: Response,
    next: NextFunction,
  ): void {
    // Executa antes dos guards e observa o status final, inclusive após filtros.
    res.once('finish', () => {
      const rota = req.route?.path ?? req.path;
      const ip = req.ip ?? req.socket?.remoteAddress ?? null;
      const user = req.user;
      if (!user) {
        if (res.statusCode === 401 || res.statusCode === 403) {
          // Não atribui identidade a claims de um token rejeitado.
          this.logger.warn(
            JSON.stringify({
              evento: 'acesso-negado',
              metodo: req.method,
              rota,
              statusCode: res.statusCode,
              ip,
            }),
          );
        }
        return;
      }
      if (!ESCRITA.has(req.method) && res.statusCode !== 403) return;
      this.auditoria.registrar({
        usuarioId: user.id,
        usuarioNome: user.nome,
        papel: user.papel,
        escolaId: user.escolaId,
        metodo: req.method,
        rota,
        caminho: (req.originalUrl ?? req.url).split('?')[0],
        statusCode: res.statusCode,
        ip,
      });
    });
    next();
  }
}
