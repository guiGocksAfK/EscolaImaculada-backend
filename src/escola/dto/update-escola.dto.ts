import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEscolaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  endereco!: string;
}
