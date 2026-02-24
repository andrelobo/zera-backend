import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { CreateTomadorDto } from './dtos/create-tomador.dto';
import { UpdateTomadorDto } from './dtos/update-tomador.dto';
import { TomadoresService } from './tomadores.service';

@ApiTags('tomadores')
@ApiBearerAuth()
@Controller('tomadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'user')
export class TomadoresController {
  constructor(private readonly tomadores: TomadoresService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar tomador' })
  @ApiBody({ type: CreateTomadorDto })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateTomadorDto) {
    return this.tomadores.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tomadores' })
  @ApiQuery({ name: 'empresaCnpj', required: false, example: '43521115000134' })
  @ApiQuery({ name: 'q', required: false, example: 'andre' })
  list(@Query('empresaCnpj') empresaCnpj?: string, @Query('q') q?: string) {
    return this.tomadores.list({ empresaCnpj, q });
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete de tomadores por empresa' })
  @ApiQuery({ name: 'empresaCnpj', required: true, example: '43521115000134' })
  @ApiQuery({ name: 'q', required: false, example: '61020788100' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  autocomplete(
    @Query('empresaCnpj') empresaCnpj: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tomadores.autocomplete({ empresaCnpj, q, limit: Number(limit) });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter tomador por id' })
  getById(@Param('id') id: string) {
    return this.tomadores.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar tomador' })
  @ApiBody({ type: UpdateTomadorDto })
  update(@Param('id') id: string, @Body() dto: UpdateTomadorDto) {
    return this.tomadores.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover tomador' })
  remove(@Param('id') id: string) {
    return this.tomadores.remove(id);
  }
}
