import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

import { CPF_REGEX, ISO_DATE, SoDigitos } from '../../common/validators.js';

export class CreateProfessoraDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @SoDigitos()
  @Matches(CPF_REGEX, { message: 'CPF deve ter 11 dígitos' })
  cpf!: string;

  @Matches(ISO_DATE, { message: 'dataNascimento deve ser YYYY-MM-DD' })
  dataNascimento!: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter ao menos 6 caracteres' })
  senha!: string;
}

export class UpdateProfessoraDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @SoDigitos()
  @Matches(CPF_REGEX, { message: 'CPF deve ter 11 dígitos' })
  cpf!: string;

  @Matches(ISO_DATE, { message: 'dataNascimento deve ser YYYY-MM-DD' })
  dataNascimento!: string;

  /** Em branco / ausente = mantém a senha atual. */
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Senha deve ter ao menos 6 caracteres' })
  senha?: string;
}
