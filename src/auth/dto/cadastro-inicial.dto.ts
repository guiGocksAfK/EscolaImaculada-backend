import { Type } from 'class-transformer';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { CPF_REGEX, ISO_DATE, SoDigitos } from '../../common/validators.js';

class DiretoraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @SoDigitos()
  @Matches(CPF_REGEX, { message: 'CPF deve ter 11 dígitos' })
  cpf!: string;

  @Matches(ISO_DATE, { message: 'dataNascimento deve ser YYYY-MM-DD' })
  dataNascimento!: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter ao menos 6 caracteres' })
  @MaxLength(72, { message: 'Senha deve ter no máximo 72 caracteres' })
  senha!: string;
}

class EscolaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  endereco!: string;
}

export class CadastroInicialDto {
  @ValidateNested()
  @Type(() => DiretoraDto)
  diretora!: DiretoraDto;

  @ValidateNested()
  @Type(() => EscolaDto)
  escola!: EscolaDto;
}
