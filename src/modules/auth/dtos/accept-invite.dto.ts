import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({ example: 'invite-token' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'new-strong-password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
