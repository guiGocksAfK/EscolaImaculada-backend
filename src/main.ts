import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

/** Teto de tamanho do corpo da requisição (o maior payload legítimo — uma
 * chamada com ~200 alunos — fica bem abaixo disso). */
const BODY_LIMIT = '200kb';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));

  // Headers de segurança. É uma API JSON pura, então a CSP restritiva do
  // helmet não atrapalha nada e serve de defesa extra.
  app.use(helmet());

  // Atrás de um reverse proxy (nginx, load balancer), o IP real do cliente
  // vem no X-Forwarded-For. Só confie nele se realmente houver um proxy —
  // caso contrário o header é falsificável e fura o rate limit.
  // TRUST_PROXY=1  -> confia em 1 hop;  TRUST_PROXY=<ip/cidr> também aceito.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const n = Number(trustProxy);
    app.set('trust proxy', Number.isFinite(n) ? n : trustProxy);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

await bootstrap();
