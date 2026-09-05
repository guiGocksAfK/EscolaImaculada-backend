import { Type } from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { IsCpf, IsDataRazoavel, SoDigitos } from '../../common/validators.js';

class DiretoraDto {
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
