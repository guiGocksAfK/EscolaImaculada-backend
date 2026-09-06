import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthUser, JwtPayload } from '../common/auth-user.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET não definida — confira o .env');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      // Pina o algoritmo — impede confusão de algoritmo / token "alg: none".
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    return {
      id: payload.sub,
      nome: payload.nome,
      papel: payload.papel,
      escolaId: payload.escolaId,
    };
  }
}
