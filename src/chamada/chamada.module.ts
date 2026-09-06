import { Module } from '@nestjs/common';

import { ChamadaController } from './chamada.controller.js';
import { ChamadaService } from './chamada.service.js';

@Module({
  controllers: [ChamadaController],
  providers: [ChamadaService],
  exports: [ChamadaService],
})
export class ChamadaModule {}
