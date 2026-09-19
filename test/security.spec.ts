import 'reflect-metadata';
import { EventEmitter } from 'node:events';
import { Logger, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { ProfessorasService } from '../src/professoras/professoras.service.js';
import { ProfessorasController } from '../src/professoras/professoras.controller.js';
import { RolesGuard } from '../src/common/roles.guard.js';
import { AuditoriaMiddleware } from '../src/auditoria/auditoria.middleware.js';
import type { AuditoriaService } from '../src/auditoria/auditoria.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { AuthUser, JwtPayload } from '../src/common/auth-user.js';
import { validateEnv } from '../src/common/env.validation.js';

const token = 'provisionamento-ficticio-para-testes-123456';
const user: AuthUser = {
  id: 'u1',
  nome: 'Professora',
  papel: 'PROFESSORA',
  escolaId: 'e1',
};
const dto = {
  escola: { nome: 'Escola', endereco: 'Rua' },
  diretora: {
    nome: 'Diretora',
    cpf: '11122233396',
    dataNascimento: '1980-01-01',
    senha: 'senha-ficticia',
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('provisionamento de escolas', () => {
  function setup() {
    const prisma = {
      usuario: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn().mockResolvedValue({ ...user, versaoSessao: 0 }),
    };
    const sign = vi.fn().mockReturnValue('jwt');
    const service = new AuthService(
      prisma as unknown as PrismaService,
      { sign } as unknown as JwtService,
    );
    return { prisma, service, sign };
  }

  it('recusa cadastro sem habilitação, antes de consultar CPFs ou banco vazio', async () => {
    vi.stubEnv('CADASTRO_INICIAL_ABERTO', '');
    vi.stubEnv('CADASTRO_INICIAL_TOKEN', token);
    const { service, prisma } = setup();
    await expect(service.cadastroInicial(dto, token)).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, 'errado', ''])(
    'recusa credencial ausente/inválida sem enumerar CPF (%s)',
    async (credencial) => {
      vi.stubEnv('CADASTRO_INICIAL_ABERTO', '1');
      vi.stubEnv('CADASTRO_INICIAL_TOKEN', token);
      const { service, prisma } = setup();
      await expect(
        service.cadastroInicial(dto, credencial),
      ).rejects.toMatchObject({ status: 403 });
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    },
  );

  it('não admite requisições concorrentes sem credencial', async () => {
    vi.stubEnv('CADASTRO_INICIAL_ABERTO', '1');
    vi.stubEnv('CADASTRO_INICIAL_TOKEN', token);
    const { service, prisma } = setup();
    const resultados = await Promise.allSettled([
      service.cadastroInicial(dto),
      service.cadastroInicial(dto),
    ]);
    expect(resultados.every((r) => r.status === 'rejected')).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('permite provisionamento explicitamente autorizado e emite versão da sessão', async () => {
    vi.stubEnv('CADASTRO_INICIAL_ABERTO', '1');
    vi.stubEnv('CADASTRO_INICIAL_TOKEN', token);
    vi.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hash');
    const { service, sign } = setup();
    await expect(service.cadastroInicial(dto, token)).resolves.toEqual({
      accessToken: 'jwt',
    });
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ versaoSessao: 0 }),
    );
  });

  it('falha no boot se habilitado sem segredo adequado', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'test',
        JWT_SECRET: token,
        CADASTRO_INICIAL_ABERTO: '1',
      }),
    ).toThrow('CADASTRO_INICIAL_TOKEN');
  });
});

describe('revogação de sessões', () => {
  it('trocar senha invalida token antigo; novo token funciona; edição de nome não revoga', async () => {
    vi.stubEnv('JWT_SECRET', token);
    vi.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hash-novo');
    let versaoSessao = 0;
    const prisma = {
      usuario: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ ...user, _count: { turmas: 0 } }),
        findUnique: vi
          .fn()
          .mockImplementation(async () => ({ ...user, versaoSessao })),
        update: vi.fn().mockImplementation(async ({ data }) => {
          versaoSessao += data.versaoSessao?.increment ?? 0;
          return {
            ...user,
            cpf: '',
            dataNascimento: '1980-01-01',
            _count: { turmas: 0 },
          };
        }),
      },
    };
    const strategy = new JwtStrategy(prisma as unknown as PrismaService);
    const service = new ProfessorasService(prisma as unknown as PrismaService);
    const payload: JwtPayload = {
      sub: user.id,
      nome: user.nome,
      papel: user.papel,
      escolaId: user.escolaId,
      versaoSessao: 0,
    };
    await expect(strategy.validate(payload)).resolves.toEqual(user);
    await service.atualizar(user, user.id, {
      nome: 'Novo nome',
      dataNascimento: '1980-01-01',
    });
    await expect(strategy.validate(payload)).resolves.toEqual(user);
    await service.atualizar(user, user.id, {
      nome: 'Novo nome',
      dataNascimento: '1980-01-01',
      senha: 'nova-senha-123',
    });
    await expect(strategy.validate(payload)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      strategy.validate({ ...payload, versaoSessao: 1 }),
    ).resolves.toEqual(user);
    await expect(
      strategy.validate({
        ...payload,
        versaoSessao: undefined,
      } as unknown as JwtPayload),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('permissão de listagem administrativa', () => {
  it.each(['PROFESSORA', 'DIRETORA'] as const)(
    'valida papel %s usando os metadados reais do controller',
    (papel) => {
      const guard = new RolesGuard(new Reflector());
      const context = {
        getHandler: () => ProfessorasController.prototype.listar,
        getClass: () => ProfessorasController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { ...user, papel } }),
        }),
      } as unknown as ExecutionContext;
      if (papel === 'DIRETORA') expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow('Sem permissão');
    },
  );
});

describe('auditoria antes dos guards', () => {
  it.each([201, 403, 409])(
    'registra status final %s sem corpo ou token',
    (statusCode) => {
      const registrar = vi.fn();
      const middleware = new AuditoriaMiddleware({
        registrar,
      } as unknown as AuditoriaService);
      const req = {
        method: 'POST',
        path: '/professoras',
        originalUrl: '/professoras?senha=nao-gravar',
        route: { path: '/professoras' },
        body: { senha: 'nao-gravar' },
        user,
        ip: '127.0.0.1',
      } as unknown as Request;
      const res = Object.assign(new EventEmitter(), { statusCode });
      const next = vi.fn();
      middleware.use(req, res as unknown as Response, next);
      expect(next).toHaveBeenCalledOnce();
      expect(registrar).not.toHaveBeenCalled();
      res.emit('finish');
      res.emit('finish');
      expect(registrar).toHaveBeenCalledOnce();
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode, usuarioId: user.id }),
      );
      expect(JSON.stringify(registrar.mock.calls)).not.toContain('nao-gravar');
    },
  );

  it('registra negação sem identidade validada apenas no log de segurança', () => {
    const registrar = vi.fn();
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const middleware = new AuditoriaMiddleware({
      registrar,
    } as unknown as AuditoriaService);
    const res = Object.assign(new EventEmitter(), { statusCode: 401 });
    middleware.use(
      {
        method: 'POST',
        path: '/auth/login',
        headers: { authorization: 'segredo' },
        socket: {},
      } as unknown as Request,
      res as unknown as Response,
      () => {},
    );
    res.emit('finish');
    expect(registrar).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain('segredo');
  });
});
