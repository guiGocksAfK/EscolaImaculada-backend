import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ResumoQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano!: number;
}
