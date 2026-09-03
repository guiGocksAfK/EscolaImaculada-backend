import { Module } from '@nestjs/common';

import { ProfessorasController } from './professoras.controller.js';
import { ProfessorasService } from './professoras.service.js';

@Module({
  controllers: [ProfessorasController],
  providers: [ProfessorasService],
})
export class ProfessorasModule {}
