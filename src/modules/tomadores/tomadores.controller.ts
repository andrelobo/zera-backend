import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import {
  assertCompanyAccess,
  resolveCompanyScope,
  type AuthenticatedUser,
} from '../auth/company-access';
import { CreateTomadorDto } from './dtos/create-tomador.dto';
import { UpdateTomadorDto } from './dtos/update-tomador.dto';
import { TomadoresService } from './tomadores.service';

@ApiTags('tomadores')
@ApiBearerAuth()
@Controller('tomadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'user', 'readonly')
export class TomadoresController {
  constructor(private readonly tomadores: TomadoresService) {}

  @Post()
  @Roles('admin', 'manager', 'user')
  @ApiOperation({ summary: 'Cadastrar tomador' })
  @ApiBody({ type: CreateTomadorDto })
  @ApiResponse({ status: 201 })
  create(@Req() req: Request, @Body() dto: CreateTomadorDto) {
    assertCompanyAccess((req as any).user as AuthenticatedUser, dto.empresaCnpj);
    return this.tomadores.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tomadores' })
  @ApiQuery({ name: 'empresaCnpj', required: false, example: '43521115000134' })
  @ApiQuery({ name: 'q', required: false, example: 'andre' })
  list(@Req() req: Request, @Query('empresaCnpj') empresaCnpj?: string, @Query('q') q?: string) {
    const scope = resolveCompanyScope((req as any).user as AuthenticatedUser, empresaCnpj);
    return this.tomadores.list({ empresaCnpj, q, allowedCompanyCnpjs: scope });
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete de tomadores por empresa' })
  @ApiQuery({ name: 'empresaCnpj', required: true, example: '43521115000134' })
  @ApiQuery({ name: 'q', required: false, example: '61020788100' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  autocomplete(
    @Req() req: Request,
    @Query('empresaCnpj') empresaCnpj: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    assertCompanyAccess((req as any).user as AuthenticatedUser, empresaCnpj);
    return this.tomadores.autocomplete({ empresaCnpj, q, limit: Number(limit) });
  }

  @Get('lookup/cpf')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({ summary: 'Enriquecer tomador PF por CPF via fonte externa' })
  @ApiQuery({ name: 'cpf', required: true, example: '61020788100' })
  @ApiQuery({ name: 'empresaCnpj', required: true, example: '43521115000134' })
  lookupCpf(
    @Req() req: Request,
    @Query('cpf') cpf: string,
    @Query('empresaCnpj') empresaCnpj: string,
  ) {
    assertCompanyAccess((req as any).user as AuthenticatedUser, empresaCnpj);
    return this.tomadores.lookupCpf({ cpf });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter tomador por id' })
  async getById(@Req() req: Request, @Param('id') id: string) {
    const doc = await this.tomadores.getById(id);
    assertCompanyAccess((req as any).user as AuthenticatedUser, doc.empresaCnpj);
    return doc;
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({ summary: 'Atualizar tomador' })
  @ApiBody({ type: UpdateTomadorDto })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTomadorDto) {
    const existing = await this.tomadores.getById(id);
    assertCompanyAccess((req as any).user as AuthenticatedUser, existing.empresaCnpj);
    return this.tomadores.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({ summary: 'Remover tomador' })
  async remove(@Req() req: Request, @Param('id') id: string) {
    const existing = await this.tomadores.getById(id);
    assertCompanyAccess((req as any).user as AuthenticatedUser, existing.empresaCnpj);
    return this.tomadores.remove(id);
  }
}
