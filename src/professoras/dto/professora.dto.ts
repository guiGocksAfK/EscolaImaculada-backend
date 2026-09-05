import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { IsCpf, IsDataRazoavel, SoDigitos } from '../../common/validators.js';

export class CreateProfessoraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @SoDigitos()
  @IsCpf()
  cpf!: string;

  @IsDataRazoavel()
  dataNascimento!: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter ao menos 6 caracteres' })
  @MaxLength(72, { message: 'Senha deve ter no máximo 72 caracteres' })
  senha!: string;
}

export class UpdateProfessoraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @SoDigitos()
  @IsCpf()
  cpf!: string;

  @IsDataRazoavel()
  dataNascimento!: string;

  /** Em branco / ausente = mantém a senha atual. */
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Senha deve ter ao menos 6 caracteres' })
  @MaxLength(72, { message: 'Senha deve ter no máximo 72 caracteres' })
  senha?: string;
}
