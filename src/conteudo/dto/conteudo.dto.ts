import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { IsDataRazoavel } from '../../common/validators.js';

export class ConteudoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @IsDataRazoavel({ futuro: true })
  data!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  disciplina?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  euOutroNos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  corpoGestos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  tracosSons?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  escutaFala?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  espacoTempo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  outras?: string;
}

export class ListarConteudoQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  turmaId?: string;
}
