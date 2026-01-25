import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin@zera.com' })
  email!: string

  @ApiProperty({ example: 'password' })
  password!: string
}
