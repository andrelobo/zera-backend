import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../../auth/schemas/user.schema';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nome Completo' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'user@zera.com' })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'new-strong-password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'manager', enum: ['admin', 'manager', 'user', 'readonly'] })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'manager', 'user', 'readonly'])
  role?: UserRole;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'] })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional({ type: [String], example: ['43521115000134'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{14}$/, { each: true })
  allowedCompanyCnpjs?: string[];
}
