import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { StatusAluno } from '../../generated/prisma/client.js';
import { IsCpf, IsDataRazoavel, SoDigitos } from '../../common/validators.js';

const STATUS: StatusAluno[] = ['ATIVO', 'TRANSFERIDO', 'DESISTENTE'];

export class CreateAlunoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @SoDigitos()
  @IsCpf({ opcional: true })
  cpf!: string;

  @IsDataRazoavel()
  dataNascimento!: string;

  @IsString()
  @MaxLength(120)
  nomePai!: string;

  @IsString()
  @MaxLength(120)
  nomeMae!: string;

  @IsString()
  @MaxLength(120)
  localNascimento!: string;

  @IsString()
  @MaxLength(200)
  endereco!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
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
  @MaxLength(64)
  turmaId?: string;

  @IsOptional()
  @IsIn(STATUS, { message: 'status inválido' })
  status?: StatusAluno;
}
