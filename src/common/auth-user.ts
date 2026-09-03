import { Papel } from '../generated/prisma/client.js';

/** Usuário autenticado, derivado das claims do JWT. */
export interface AuthUser {
  id: string;
  nome: string;
  papel: Papel;
  escolaId: string;
}

/** Claims que viajam dentro do JWT. */
export interface JwtPayload {
  sub: string;
  nome: string;
  papel: Papel;
  escolaId: string;
}
