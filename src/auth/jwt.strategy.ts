import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthUser, JwtPayload } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
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

  /**
   * Confere a conta no banco a cada requisição, em vez de confiar apenas nas
   * claims. A versão da sessão revoga tokens após troca de senha. Sem esta consulta, uma
   * professora removida continuaria entrando até o token expirar, e uma
   * mudança de papel só valeria no próximo login. Como o retorno vem do
   * banco, papel e escola atuais mandam — o token só diz *quem* é.
   *
   * Custo: uma consulta por chave primária a cada requisição autenticada.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub || !Number.isInteger(payload.versaoSessao)) {
      throw new UnauthorizedException();
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nome: true,
        papel: true,
        escolaId: true,
        versaoSessao: true,
      },
    });
    if (!usuario || usuario.versaoSessao !== payload.versaoSessao) {
      // Conta removida, ou escola excluída (que apaga as contas junto).
      throw new UnauthorizedException('Sessão inválida');
    }

    const { versaoSessao: _versaoSessao, ...user } = usuario;
    return user;
  }
}
