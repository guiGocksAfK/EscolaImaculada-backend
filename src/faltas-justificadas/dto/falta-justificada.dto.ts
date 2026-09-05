import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ISO_DATE } from '../../common/validators.js';

export class FaltaJustificadaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  alunoId!: string;

  @Matches(ISO_DATE, { message: 'data deve ser YYYY-MM-DD' })
  data!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo!: string;
}

export class ListarFaltasQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  turmaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  alunoId?: string;
}
