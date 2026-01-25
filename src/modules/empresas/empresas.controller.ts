import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/guards/roles.decorator'
import { CreateEmpresaDto } from './dtos/create-empresa.dto'
import { UpdateEmpresaDto } from './dtos/update-empresa.dto'
import { EmpresasService } from './empresas.service'

@ApiTags('empresas')
@ApiBearerAuth()
@Controller('empresas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Post()
  @ApiOperation({ summary: 'Create empresa from CNPJ' })
  @ApiBody({ type: CreateEmpresaDto })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateEmpresaDto) {
    return this.empresas.createFromCnpj(dto.cnpj)
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview empresa data from CNPJ (no persistence)' })
  @ApiBody({ type: CreateEmpresaDto })
  @ApiResponse({ status: 200 })
  preview(@Body() dto: CreateEmpresaDto) {
    return this.empresas.previewFromCnpj(dto.cnpj)
  }

  @Get()
  @ApiOperation({ summary: 'List empresas' })
  list() {
    return this.empresas.list()
  }

  @Get('cnpj/:cnpj')
  @ApiOperation({ summary: 'Get empresa by CNPJ' })
  async getByCnpj(@Param('cnpj') cnpj: string) {
    const doc = await this.empresas.getByCnpj(cnpj)
    if (!doc) return { found: false }
    return doc
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get empresa by id' })
  async getById(@Param('id') id: string) {
    const doc = await this.empresas.getById(id)
    if (!doc) return { found: false }
    return doc
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update empresa' })
  @ApiBody({ type: UpdateEmpresaDto })
  update(@Param('id') id: string, @Body() dto: UpdateEmpresaDto) {
    return this.empresas.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete empresa' })
  remove(@Param('id') id: string) {
    return this.empresas.remove(id)
  }
}
