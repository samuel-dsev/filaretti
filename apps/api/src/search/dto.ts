import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { SearchKind } from '@filaretti/types';

export class SearchPaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 12;
}

export class PublicSearchDto extends SearchPaginationDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^[^\u0000-\u001f\u007f]+$/u)
  q!: string;

  @ApiPropertyOptional({ enum: ['all', 'article', 'area', 'professional'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'article', 'area', 'professional'])
  kind: SearchKind | 'all' = 'all';
}
