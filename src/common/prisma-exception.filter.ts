import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface PrismaKnownError {
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    (err as { code: string }).code.startsWith('P')
  );
}

/**
 * Traduz erros conhecidos do Prisma para respostas HTTP amigáveis,
 * evitando vazar detalhes internos do banco.
 */
@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Deixa as HttpException do Nest seguirem o fluxo padrão.
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'getStatus' in exception &&
      typeof (exception as { getStatus: unknown }).getStatus === 'function'
    ) {
      const httpEx = exception as {
        getStatus: () => number;
        getResponse: () => unknown;
      };
      response.status(httpEx.getStatus()).json(httpEx.getResponse());
      return;
    }

    if (isPrismaKnownError(exception)) {
      const { status, message } = this.mapear(exception);
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(exception.message);
      }
      response.status(status).json({ statusCode: status, message });
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno',
    });
  }

  private mapear(err: PrismaKnownError): { status: number; message: string } {
    switch (err.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Registro duplicado (valor único já em uso)',
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Operação bloqueada: há registros vinculados',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro interno',
        };
    }
  }
}
