import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../../auth/schemas/user.schema';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({ example: 'user', enum: ['admin', 'manager', 'user'] })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'manager', 'user'])
  role?: UserRole;
}
