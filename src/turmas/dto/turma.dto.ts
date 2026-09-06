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

import { Periodo } from '../../generated/prisma/client.js';

const PERIODOS: Periodo[] = ['MANHA', 'TARDE', 'INTEGRAL'];

export class TurmaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome!: string;

  @IsIn(PERIODOS, { message: 'periodo inválido' })
  periodo!: Periodo;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anoLetivo!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  professoraId!: string;
}
