import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator.js';

interface Contador {
  count: number;
  /** epoch ms em que a janela atual expira. */
  reset: number;
}

/**
 * Rate limiting simples por IP, janela fixa em memória.
 *
 * Suficiente para conter brute-force num deploy single-instance. Se um dia
 * rodar em múltiplas instâncias, trocar o Map por um store compartilhado
 * (Redis) — ou adotar @nestjs/throttler quando ele suportar o NestJS 12.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Contador>();

  private readonly ttlPadrao =
    Number(process.env.THROTTLE_TTL) > 0 ? Number(process.env.THROTTLE_TTL) : 60;
  private readonly limitePadrao =
    Number(process.env.THROTTLE_LIMIT) > 0
      ? Number(process.env.THROTTLE_LIMIT)
      : 120;

  /** Desliga o rate limit (ex.: rodar a suíte de smoke sem tomar 429). */
  private readonly desligado =
    process.env.RATE_LIMIT_DISABLED === '1' ||
    process.env.RATE_LIMIT_DISABLED === 'true';

  constructor(private readonly reflector: Reflector) {
    // Limpeza periódica das janelas expiradas (evita vazamento de memória).
    const timer = setInterval(() => this.limpar(), 60_000);
    timer.unref?.();
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.desligado) {
      return true;
    }

    const override = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    const ttl = override?.ttl ?? this.ttlPadrao;
    const limit = override?.limit ?? this.limitePadrao;

    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.ipDe(req);
    const rota = `${req.method}:${req.route?.path ?? req.path}`;
    const chave = `${ip}|${rota}`;

    const agora = Date.now();
    const atual = this.buckets.get(chave);

    if (!atual || atual.reset <= agora) {
      this.buckets.set(chave, { count: 1, reset: agora + ttl * 1000 });
      return true;
    }

    atual.count += 1;
    if (atual.count > limit) {
      const retryAfter = Math.ceil((atual.reset - agora) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Muitas requisições. Tente novamente em ${retryAfter}s.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private ipDe(req: Request): string {
    // Confia no req.ip (Express respeita 'trust proxy' quando configurado).
    // Fallback para o socket caso algo não popule req.ip.
    return req.ip ?? req.socket?.remoteAddress ?? 'desconhecido';
  }

  private limpar(): void {
    const agora = Date.now();
    for (const [chave, c] of this.buckets) {
      if (c.reset <= agora) {
        this.buckets.delete(chave);
      }
    }
  }
}
