import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IsDataRazoavel } from '../../common/validators.js';

export class FaltaJustificadaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  alunoId!: string;

  @IsDataRazoavel()
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
