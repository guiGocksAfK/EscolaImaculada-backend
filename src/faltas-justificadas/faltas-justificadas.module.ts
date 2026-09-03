import { Module } from '@nestjs/common';

import { FaltasJustificadasController } from './faltas-justificadas.controller.js';
import { FaltasJustificadasService } from './faltas-justificadas.service.js';

@Module({
  controllers: [FaltasJustificadasController],
  providers: [FaltasJustificadasService],
})
export class FaltasJustificadasModule {}
