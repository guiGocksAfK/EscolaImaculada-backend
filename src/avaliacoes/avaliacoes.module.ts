import { Module } from '@nestjs/common';

import { AvaliacoesController } from './avaliacoes.controller.js';
import { AvaliacoesService } from './avaliacoes.service.js';

@Module({
  controllers: [AvaliacoesController],
  providers: [AvaliacoesService],
})
export class AvaliacoesModule {}
