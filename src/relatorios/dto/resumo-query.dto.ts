import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class ResumoQueryDto {
  @IsString()
  @MinLength(1)
  turmaId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano!: number;
}
