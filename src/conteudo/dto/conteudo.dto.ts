import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IsDataRazoavel } from '../../common/validators.js';

export class ConteudoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @IsDataRazoavel({ futuro: true })
  data!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  conteudo!: string;
}

export class ListarConteudoQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  turmaId?: string;
}
