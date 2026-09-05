import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { CPF_REGEX, SoDigitos } from '../../common/validators.js';

export class LoginDto {
  @SoDigitos()
  @Matches(CPF_REGEX, { message: 'CPF deve ter 11 dígitos' })
  cpf!: string;

  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  @MaxLength(200)
  senha!: string;
}
