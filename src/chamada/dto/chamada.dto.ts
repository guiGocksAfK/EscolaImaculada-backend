import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { StatusDia } from '../../generated/prisma/client.js';
import { IsDataRazoavel } from '../../common/validators.js';

const STATUS_DIA: StatusDia[] = ['C', 'F', 'D'];

export class RegistroDiaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  alunoId!: string;

  @IsIn(STATUS_DIA, { message: 'status do dia inválido' })
  status!: StatusDia;
}

export class SalvarChamadaDiaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @IsDataRazoavel({ futuro: true })
  data!: string;

  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RegistroDiaDto)
  registros!: RegistroDiaDto[];
}

export class ChamadaDiaQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  turmaId!: string;

  @IsDataRazoavel({ futuro: true })
  data!: string;
}

export class ChamadaMensalQueryDto {
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
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
