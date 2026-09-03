import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige um JWT válido no header Authorization: Bearer <token>. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
