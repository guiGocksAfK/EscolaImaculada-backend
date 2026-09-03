import { IsString, MinLength } from 'class-validator';

export class UpdateEscolaDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsString()
  @MinLength(2)
  endereco!: string;
}
