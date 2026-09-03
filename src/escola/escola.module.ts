import { Module } from '@nestjs/common';

import { EscolaController } from './escola.controller.js';
import { EscolaService } from './escola.service.js';

@Module({
  controllers: [EscolaController],
  providers: [EscolaService],
})
export class EscolaModule {}
