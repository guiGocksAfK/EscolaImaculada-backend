import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListarAuditoriaDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  usuarioId?: string;

  @IsOptional()
  @IsIn(['POST', 'PUT', 'PATCH', 'DELETE'])
  metodo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}
