import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AvaliacaoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  alunoId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  texto!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  referencia!: string;
}

export class ListarAvaliacoesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  turmaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  alunoId?: string;
}
