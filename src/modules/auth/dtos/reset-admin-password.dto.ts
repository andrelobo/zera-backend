import { ApiProperty } from '@nestjs/swagger'

export class ResetAdminPasswordDto {
  @ApiProperty({ example: 'admin@zera.com' })
  email!: string

  @ApiProperty({ example: 'new-strong-password' })
  password!: string
}
