import { ApiProperty } from '@nestjs/swagger'

export class BootstrapAdminDto {
  @ApiProperty({ example: 'admin@zera.com' })
  email!: string

  @ApiProperty({ example: 'password' })
  password!: string
}
