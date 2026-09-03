import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { StatusDia } from '../../generated/prisma/client.js';
import { ISO_DATE } from '../../common/validators.js';

const STATUS_DIA: StatusDia[] = ['C', 'F', 'D'];

export class RegistroDiaDto {
  @IsString()
  @MinLength(1)
  alunoId!: string;

  @IsIn(STATUS_DIA, { message: 'status do dia inválido' })
  status!: StatusDia;
}

export class SalvarChamadaDiaDto {
  @IsString()
  @MinLength(1)
  turmaId!: string;

  @Matches(ISO_DATE, { message: 'data deve ser YYYY-MM-DD' })
  data!: string;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => RegistroDiaDto)
  registros!: RegistroDiaDto[];
}

export class ChamadaDiaQueryDto {
  @IsString()
  @MinLength(1)
  turmaId!: string;

  @Matches(ISO_DATE, { message: 'data deve ser YYYY-MM-DD' })
  data!: string;
}

export class ChamadaMensalQueryDto {
  @IsString()
  @MinLength(1)
  turmaId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
