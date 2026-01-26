import { ApiPropertyOptional } from '@nestjs/swagger'
import type { UserRole } from '../../auth/schemas/user.schema'

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nome Completo' })
  name?: string

  @ApiPropertyOptional({ example: 'user@zera.com' })
  email?: string

  @ApiPropertyOptional({ example: 'new-strong-password' })
  password?: string

  @ApiPropertyOptional({ example: 'manager', enum: ['admin', 'manager', 'user'] })
  role?: UserRole

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'] })
  status?: 'active' | 'inactive'
}
