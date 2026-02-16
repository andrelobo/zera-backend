import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ResetAdminPasswordDto {
  @ApiProperty({ example: 'admin@zera.com' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'new-strong-password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
