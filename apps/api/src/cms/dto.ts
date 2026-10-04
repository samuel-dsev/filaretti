import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MediaVisibility } from '@prisma/client';
import { PaginationDto } from '../domain/dto';

export class MediaQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) q?: string;
  @ApiPropertyOptional({ enum: ['image', 'pdf'] })
  @IsOptional()
  @IsEnum({ image: 'image', pdf: 'pdf' })
  kind?: 'image' | 'pdf';
}
export class MediaMetadataDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(300) alt?:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(500) source?:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(300) license?:
    string | null;
}
export class MediaUploadDto extends MediaMetadataDto {
  @ApiPropertyOptional({ enum: MediaVisibility, default: 'PUBLIC' })
  @IsOptional()
  @IsEnum(MediaVisibility)
  visibility?: MediaVisibility;
}
export class MediaPatchDto extends PartialType(MediaMetadataDto) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
