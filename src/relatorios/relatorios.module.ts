import { Module } from '@nestjs/common';

import { ChamadaModule } from '../chamada/chamada.module.js';
import { RelatoriosController } from './relatorios.controller.js';
import { RelatoriosService } from './relatorios.service.js';

@Module({
  imports: [ChamadaModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
