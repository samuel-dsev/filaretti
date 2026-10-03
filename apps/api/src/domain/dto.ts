import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ArticleType, PublicationStatus } from '@prisma/client';
import type { PageSection, TipTapDocument } from '@filaretti/types';
import {
  InternalPathConstraint,
  PageSectionsConstraint,
  SafeUrlConstraint,
  TipTapConstraint,
} from './content';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ default: 12, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 12;
  @ApiPropertyOptional({ enum: ['newest', 'oldest', 'title', 'name', 'order'] })
  @IsOptional()
  @IsString()
  @Matches(/^(newest|oldest|title|name|order)$/u)
  sort?: string;
}
export class ArticleQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) area?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) professional?: string;
  @ApiPropertyOptional({ description: 'Alias de professional (slug do profissional público).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) tag?: string;
  @ApiPropertyOptional({ enum: ArticleType }) @IsOptional() @IsEnum(ArticleType) type?: ArticleType;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;
}
export class AdminArticleQueryDto extends ArticleQueryDto {
  @ApiPropertyOptional({ enum: PublicationStatus })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;
}
export class FaqQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) area?: string;
}
export class VersionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version!: number;
}
export class TaxonomyDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u) @MaxLength(120) slug!: string;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
export class TaxonomyPatchDto extends PartialType(TaxonomyDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class ArticleDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u) @MaxLength(120) slug!: string;
  @ApiProperty() @IsString() @MaxLength(500) excerpt!: string;
  @ApiProperty({ type: Object, description: 'Documento TipTap validado; ver docs/api.md.' })
  @Validate(TipTapConstraint)
  content!: TipTapDocument;
  @ApiProperty({ enum: ArticleType }) @IsEnum(ArticleType) type!: ArticleType;
  @ApiProperty() @IsUUID() authorId!: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() coverMediaId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() pdfMediaId?: string | null;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  featured?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  categoryIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  practiceAreaIds?: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(70) seoTitle?:
    string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescription?: string | null;
}
export class ArticlePatchDto extends PartialType(ArticleDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class ProfessionalDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u) @MaxLength(120) slug!: string;
  @ApiProperty() @IsString() @MaxLength(160) title!: string;
  @ApiProperty({ type: Object }) @Validate(TipTapConstraint) bio!: TipTapDocument;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(400, { each: true })
  education!: string[];
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(400, { each: true })
  experience!: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() photoMediaId?: string | null;
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  practiceAreaIds?: string[];
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
export class ProfessionalPatchDto extends PartialType(ProfessionalDto, {
  skipNullProperties: false,
}) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class PracticeAreaDto extends TaxonomyDto {
  @ApiProperty() @IsString() @MaxLength(500) summary!: string;
  @ApiProperty({ type: Object }) @Validate(TipTapConstraint) description!: TipTapDocument;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(400, { each: true })
  services!: string[];
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
export class PracticeAreaPatchDto extends PartialType(PracticeAreaDto, {
  skipNullProperties: false,
}) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class PageDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u) @MaxLength(120) slug!: string;
  @ApiProperty({ type: [Object] }) @Validate(PageSectionsConstraint) sections!: PageSection[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(70) seoTitle?:
    string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescription?: string | null;
}
export class PagePatchDto extends PartialType(PageDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class PublicationDto extends VersionDto {
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsEnum({ DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' })
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
export class FaqDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) question!: string;
  @ApiProperty({ type: Object }) @Validate(TipTapConstraint) answer!: TipTapDocument;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() practiceAreaId?: string | null;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
export class FaqPatchDto extends PartialType(FaqDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class SocialLinkDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) label!: string;
  @ApiProperty() @Validate(SafeUrlConstraint) url!: string;
}
export class AddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) country?: string;
}
export class SettingsPatchDto extends VersionDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  siteName?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsEmail() @MaxLength(254) publicEmail?:
    string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(40) publicPhone?:
    string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Validate(SafeUrlConstraint)
  @MaxLength(500)
  whatsappUrl?: string | null;
  @ApiPropertyOptional({ type: AddressDto })
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => AddressDto)
  @ValidateNested()
  address?: AddressDto;
  @ApiPropertyOptional({ type: [SocialLinkDto] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(15)
  @Type(() => SocialLinkDto)
  @ValidateNested({ each: true })
  socialLinks?: SocialLinkDto[];
}
export class RedirectDto {
  @ApiProperty() @Validate(InternalPathConstraint) sourcePath!: string;
  @ApiProperty() @Validate(InternalPathConstraint) targetPath!: string;
  @ApiPropertyOptional({ enum: [301, 302, 307, 308] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum({ moved: 301, found: 302, temporary: 307, permanent: 308 })
  statusCode?: number;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
export class RedirectPatchDto extends PartialType(RedirectDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
