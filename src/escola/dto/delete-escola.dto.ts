import { IsString, MaxLength, MinLength } from 'class-validator';

/** Exclusão da escola exige a senha da diretora de novo (ação destrutiva). */
export class DeleteEscolaDto {
  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  @MaxLength(200)
  senha!: string;
}
