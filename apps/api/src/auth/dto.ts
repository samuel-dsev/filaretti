import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.invalid' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Usuário fictício' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 160)
  name!: string;

  @ApiProperty({ example: 'editor@example.invalid' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(12, 128)
  password!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}

export class RecoveryRequestDto {
  @ApiProperty({ example: 'admin@example.invalid' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class RecoveryResetDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(64, 64)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}

export class UserListDto {
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
