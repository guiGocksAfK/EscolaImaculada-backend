import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import type { AuthUser } from '../common/auth-user.js';
import { AuditoriaService } from './auditoria.service.js';

const METODOS_AUDITADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Registra toda operação de escrita feita por um usuário autenticado —
 * inclusive as que falham (403/404/409), que revelam tentativas indevidas.
 * Nunca registra o corpo da requisição (pode conter senha).
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(private readonly auditoria: AuditoriaService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthUser }>();

    if (!METODOS_AUDITADOS.has(req.method) || !req.user) {
      return next.handle();
    }

    const user = req.user;
    const rota = req.route?.path ?? req.path;
    const caminho = (req.originalUrl ?? req.url).split('?')[0];
    const ip = req.ip ?? req.socket?.remoteAddress ?? null;
    const res = http.getResponse<Response>();

    const gravar = (statusCode: number): void =>
      this.auditoria.registrar({
        usuarioId: user.id,
        usuarioNome: user.nome,
        papel: user.papel,
        escolaId: user.escolaId,
        metodo: req.method,
        rota,
        caminho,
        statusCode,
        ip,
      });

    return next.handle().pipe(
      tap({
        next: () => gravar(res.statusCode),
        error: (err: { status?: number; statusCode?: number }) =>
          gravar(Number(err?.status ?? err?.statusCode ?? 500)),
      }),
    );
  }
}
