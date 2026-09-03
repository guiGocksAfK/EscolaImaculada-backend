import { Module } from '@nestjs/common';

import { ConteudoController } from './conteudo.controller.js';
import { ConteudoService } from './conteudo.service.js';

@Module({
  controllers: [ConteudoController],
  providers: [ConteudoService],
})
export class ConteudoModule {}
