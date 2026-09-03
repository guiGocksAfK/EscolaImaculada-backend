import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

import { StatusAluno } from '../../generated/prisma/client.js';
import { ISO_DATE } from '../../common/validators.js';

const STATUS: StatusAluno[] = ['ATIVO', 'TRANSFERIDO', 'DESISTENTE'];

export class CreateAlunoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsString()
  cpf!: string;

  @Matches(ISO_DATE, { message: 'dataNascimento deve ser YYYY-MM-DD' })
  dataNascimento!: string;

  @IsString()
  nomePai!: string;

  @IsString()
  nomeMae!: string;

  @IsString()
  localNascimento!: string;

  @IsString()
  endereco!: string;

  @IsString()
  @MinLength(1)
  turmaId!: string;
}

export class UpdateAlunoDto extends CreateAlunoDto {
  @IsIn(STATUS, { message: 'status inválido' })
  status!: StatusAluno;
}

export class AlterarStatusDto {
  @IsIn(STATUS, { message: 'status inválido' })
  status!: StatusAluno;
}

export class ListarAlunosQueryDto {
  @IsOptional()
  @IsString()
  turmaId?: string;

  @IsOptional()
  @IsIn(STATUS, { message: 'status inválido' })
  status?: StatusAluno;
}
