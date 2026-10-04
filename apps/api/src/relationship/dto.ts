import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContactStatus, SubscriberStatus } from '@prisma/client';
import { PaginationDto, VersionDto } from '../domain/dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const optionalTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const boolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ContactDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiProperty() @Transform(email) @IsEmail() @MaxLength(254) email!: string;
  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @Matches(/^[+()\d .-]{6,40}$/u)
  phone?: string;
  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @Matches(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/u)
  state?: string;
  @ApiPropertyOptional() @Transform(optionalTrim) @IsOptional() @IsUUID() practiceAreaId?: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(3) @MaxLength(200) subject!: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(10) @MaxLength(10000) message!: string;
  @ApiProperty({ enum: [true] }) @Transform(boolean) @Equals(true) privacyAccepted!: true;
  @ApiPropertyOptional() @Transform(boolean) @IsOptional() @IsBoolean() newsletterConsent?: boolean;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2048) turnstileToken!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') idempotencyKey!: string;
}

export class NewsletterSubscribeDto {
  @ApiProperty() @Transform(email) @IsEmail() @MaxLength(254) email!: string;
  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
  @ApiProperty({ enum: [true] }) @Equals(true) consent!: true;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2048) turnstileToken!: string;
}

export class NewsletterTokenDto {
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{64}$/u) token!: string;
}

export class ContactQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ContactStatus })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;
  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class SubscriberQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SubscriberStatus })
  @IsOptional()
  @IsEnum(SubscriberStatus)
  status?: SubscriberStatus;
  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class ContactStatusDto extends VersionDto {
  @ApiProperty({ enum: ContactStatus }) @IsEnum(ContactStatus) status!: ContactStatus;
}
