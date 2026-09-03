import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AlunosModule } from './alunos/alunos.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvaliacoesModule } from './avaliacoes/avaliacoes.module.js';
import { ChamadaModule } from './chamada/chamada.module.js';
import { CommonModule } from './common/common.module.js';
import { ConteudoModule } from './conteudo/conteudo.module.js';
import { EscolaModule } from './escola/escola.module.js';
import { FaltasJustificadasModule } from './faltas-justificadas/faltas-justificadas.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfessorasModule } from './professoras/professoras.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';
import { TurmasModule } from './turmas/turmas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuthModule,
    EscolaModule,
    ProfessorasModule,
    TurmasModule,
    AlunosModule,
    ChamadaModule,
    ConteudoModule,
    AvaliacoesModule,
    FaltasJustificadasModule,
    RelatoriosModule,
  ],
})
export class AppModule {}
