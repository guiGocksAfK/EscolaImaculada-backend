import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ISO_DATE } from '../../common/validators.js';

export class ConteudoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @Matches(ISO_DATE, { message: 'data deve ser YYYY-MM-DD' })
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
