import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { InviteUserDto } from './dtos/invite-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  list() {
    return this.users.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  getById(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(
      dto.name,
      dto.email,
      dto.password,
      dto.role ?? 'user',
      dto.status ?? 'active',
      dto.allowedCompanyCnpjs ?? [],
    );
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite user for first access' })
  @ApiBody({ type: InviteUserDto })
  @ApiResponse({ status: 201 })
  invite(@Body() dto: InviteUserDto) {
    return this.users.invite(
      dto.name,
      dto.email,
      dto.role ?? 'user',
      dto.allowedCompanyCnpjs ?? [],
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiBody({ type: UpdateUserDto })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
