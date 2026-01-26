import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { UserRole } from '../../auth/schemas/user.schema'

export class CreateUserDto {
  @ApiProperty({ example: 'Nome Completo' })
  name!: string

  @ApiProperty({ example: 'user@zera.com' })
  email!: string

  @ApiProperty({ example: 'strong-password' })
  password!: string

  @ApiPropertyOptional({ example: 'user', enum: ['admin', 'manager', 'user'] })
  role?: UserRole

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'] })
  status?: 'active' | 'inactive'
}
