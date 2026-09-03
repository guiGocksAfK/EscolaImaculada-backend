import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

import { ISO_DATE } from '../../common/validators.js';

export class FaltaJustificadaDto {
  @IsString()
  @MinLength(1)
  alunoId!: string;

  @Matches(ISO_DATE, { message: 'data deve ser YYYY-MM-DD' })
  data!: string;

  @IsString()
  @MinLength(1)
  motivo!: string;
}

export class ListarFaltasQueryDto {
  @IsOptional()
  @IsString()
  turmaId?: string;

  @IsOptional()
  @IsString()
  alunoId?: string;
}
