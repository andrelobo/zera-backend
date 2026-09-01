import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../../auth/schemas/user.schema';
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ example: 'Nome Completo' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'user@zera.com' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'user', enum: ['admin', 'manager', 'user', 'readonly'] })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'manager', 'user', 'readonly'])
  role?: UserRole;

  @ApiPropertyOptional({ type: [String], example: ['43521115000134'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{14}$/, { each: true })
  allowedCompanyCnpjs?: string[];
}
