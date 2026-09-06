import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaInterceptor } from './auditoria.interceptor.js';
import { AuditoriaService } from './auditoria.service.js';

@Module({
  controllers: [AuditoriaController],
  providers: [
    AuditoriaService,
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AuditoriaModule {}
