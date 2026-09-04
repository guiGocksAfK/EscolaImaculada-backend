import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';

import type { JwtPayload } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CadastroInicialDto } from './dto/cadastro-inicial.dto.js';
import { LoginDto } from './dto/login.dto.js';

const SALT_ROUNDS = 10;

export interface TokenResponse {
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ cpf, senha }: LoginDto): Promise<TokenResponse> {
    const usuario = await this.prisma.usuario.findUnique({ where: { cpf } });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.assinar(usuario);
  }

  /**
   * Cadastro de uma escola nova: cria a escola + a conta da diretora dela
   * e já autentica. Cada escola é independente (multi-tenant por escolaId).
   */
  async cadastroInicial(dto: CadastroInicialDto): Promise<TokenResponse> {
    const cpfEmUso = await this.prisma.usuario.findUnique({
      where: { cpf: dto.diretora.cpf },
      select: { id: true },
    });
    if (cpfEmUso) {
      throw new ConflictException(
        'Já existe uma conta com esse CPF. Use a tela de login.',
      );
    }

    const senhaHash = await bcrypt.hash(dto.diretora.senha, SALT_ROUNDS);

    const diretora = await this.prisma.$transaction(async (tx) => {
      const escola = await tx.escola.create({
        data: {
          nome: dto.escola.nome.trim(),
          endereco: dto.escola.endereco.trim(),
        },
      });
      return tx.usuario.create({
        data: {
          nome: dto.diretora.nome.trim(),
          cpf: dto.diretora.cpf,
          dataNascimento: dto.diretora.dataNascimento,
          senhaHash,
          papel: 'DIRETORA',
          escolaId: escola.id,
        },
      });
    });

    return this.assinar(diretora);
  }

  private assinar(usuario: {
    id: string;
    nome: string;
    papel: JwtPayload['papel'];
    escolaId: string;
  }): TokenResponse {
    const payload: JwtPayload = {
      sub: usuario.id,
      nome: usuario.nome,
      papel: usuario.papel,
      escolaId: usuario.escolaId,
    };
    return { accessToken: this.jwt.sign(payload) };
  }
}
