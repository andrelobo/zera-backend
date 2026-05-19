import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../../auth/schemas/user.schema';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

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
}
