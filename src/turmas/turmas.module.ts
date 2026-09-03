import { Module } from '@nestjs/common';

import { TurmasController } from './turmas.controller.js';
import { TurmasService } from './turmas.service.js';

@Module({
  controllers: [TurmasController],
  providers: [TurmasService],
})
export class TurmasModule {}
