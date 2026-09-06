import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegistroSemestralQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano!: number;

  @Type(() => Number)
  @IsIn([1, 2], { message: 'semestre deve ser 1 ou 2' })
  semestre!: 1 | 2;
}
