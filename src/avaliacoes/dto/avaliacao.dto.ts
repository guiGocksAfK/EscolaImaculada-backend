import { IsOptional, IsString, MinLength } from 'class-validator';

export class AvaliacaoDto {
  @IsString()
  @MinLength(1)
  alunoId!: string;

  @IsString()
  @MinLength(1)
  turmaId!: string;

  @IsString()
  @MinLength(1)
  texto!: string;

  @IsString()
  @MinLength(1)
  referencia!: string;
}

export class ListarAvaliacoesQueryDto {
  @IsOptional()
  @IsString()
  turmaId?: string;

  @IsOptional()
  @IsString()
  alunoId?: string;
}
