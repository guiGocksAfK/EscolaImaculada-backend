import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaMiddleware } from './auditoria.middleware.js';
import { AuditoriaService } from './auditoria.service.js';

@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, AuditoriaMiddleware],
})
export class AuditoriaModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuditoriaMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
