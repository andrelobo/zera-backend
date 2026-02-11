import { Body, Controller, Headers, NotFoundException, Post, UnauthorizedException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dtos/login.dto'
import { BootstrapAdminDto } from './dtos/bootstrap-admin.dto'
import { ResetAdminPasswordDto } from './dtos/reset-admin-password.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login and receive access token' })
  @ApiBody({
    type: LoginDto,
    examples: {
      default: {
        summary: 'Login user example',
        value: {
          email: 'loboandre@hotmail.com',
          password: 'sua-senha-aqui',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Access token' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password)
  }

  @Post('bootstrap')
  @ApiOperation({ summary: 'Create the first admin user' })
  @ApiBody({ type: BootstrapAdminDto })
  @ApiResponse({ status: 201, description: 'Admin created' })
  bootstrapAdmin(
    @Body() dto: BootstrapAdminDto,
    @Headers('x-admin-setup-token') setupToken?: string,
  ) {
    const bootstrapEnabled = process.env.BOOTSTRAP_ENABLED !== 'false'
    if (process.env.NODE_ENV === 'production' || !bootstrapEnabled) {
      throw new NotFoundException()
    }

    const expected = process.env.ADMIN_SETUP_TOKEN ?? ''
    if (!expected || setupToken !== expected) {
      throw new UnauthorizedException('Invalid setup token')
    }

    return this.auth.bootstrapAdmin(dto.name, dto.email, dto.password)
  }

  @Post('admin/reset-password')
  @ApiOperation({ summary: 'Reset admin password via setup token' })
  @ApiBody({ type: ResetAdminPasswordDto })
  @ApiResponse({ status: 200, description: 'Admin password reset' })
  resetAdminPassword(
    @Body() dto: ResetAdminPasswordDto,
    @Headers('x-admin-setup-token') setupToken?: string,
  ) {
    const resetEnabled = process.env.ADMIN_RESET_ENABLED !== 'false'
    if (!resetEnabled) {
      throw new NotFoundException()
    }

    const expected = process.env.ADMIN_SETUP_TOKEN ?? ''
    if (!expected || setupToken !== expected) {
      throw new UnauthorizedException('Invalid setup token')
    }

    return this.auth.resetAdminPassword(dto.email, dto.password)
  }
}
