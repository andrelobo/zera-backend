import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'loboandre@hotmail.com' })
  email!: string

  @ApiProperty({ example: 'sua-senha-aqui' })
  password!: string
}
