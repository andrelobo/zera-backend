import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { LoginDto } from './dtos/login.dto'
import { BootstrapAdminDto } from './dtos/bootstrap-admin.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login and receive access token' })
  @ApiBody({ type: LoginDto })
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
    const expected = process.env.ADMIN_SETUP_TOKEN ?? ''
    if (!expected || setupToken !== expected) {
      throw new UnauthorizedException('Invalid setup token')
    }

    return this.auth.bootstrapAdmin(dto.email, dto.password)
  }
}
