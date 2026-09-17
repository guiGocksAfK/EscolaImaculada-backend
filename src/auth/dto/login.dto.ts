import { IsString, MaxLength, MinLength } from 'class-validator';

import { IsCpf, SoDigitos } from '../../common/validators.js';

export class LoginDto {
  @SoDigitos()
  @IsCpf()
  cpf!: string;

  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  // 72 = o que o bcrypt de fato compara; alinhado com o cadastro.
  @MaxLength(72)
  senha!: string;
}
