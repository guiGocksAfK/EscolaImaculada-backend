import { IsString, MaxLength, MinLength } from 'class-validator';

import { IsCpf, SoDigitos } from '../../common/validators.js';

export class LoginDto {
  @SoDigitos()
  @IsCpf()
  cpf!: string;

  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  @MaxLength(200)
  senha!: string;
}
