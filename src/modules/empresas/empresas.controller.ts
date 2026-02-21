import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { File as MulterFile } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { CreateEmpresaDto } from './dtos/create-empresa.dto';
import { ImportCertificadoDto } from './dtos/import-certificado.dto';
import { UpdateEmpresaDto } from './dtos/update-empresa.dto';
import { EmpresasService } from './empresas.service';

@ApiTags('empresas')
@ApiBearerAuth()
@Controller('empresas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create empresa from CNPJ' })
  @ApiBody({ type: CreateEmpresaDto })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateEmpresaDto) {
    return this.empresas.createFromCnpj(dto.cnpj, dto);
  }

  @Post('preview')
  @Roles('admin')
  @ApiOperation({ summary: 'Preview empresa data from CNPJ (no persistence)' })
  @ApiBody({ type: CreateEmpresaDto })
  @ApiResponse({ status: 200 })
  preview(@Body() dto: CreateEmpresaDto) {
    return this.empresas.previewFromCnpj(dto.cnpj);
  }

  @Post('certificado/import')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Importar certificado digital (.pfx/.p12) por CNPJ' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['cnpj', 'senhaCertificado', 'file'],
      properties: {
        cnpj: { type: 'string', example: '43521115000134' },
        senhaCertificado: { type: 'string', example: 'senha-do-certificado' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Certificado importado com sucesso' })
  async importCertificado(@Body() dto: ImportCertificadoDto, @UploadedFile() file?: MulterFile) {
    if (!file) {
      throw new BadRequestException({
        code: 'CERT_FILE_REQUIRED',
        message: 'Arquivo .pfx/.p12 é obrigatório',
      });
    }
    return this.empresas.importCertificado(dto.cnpj, dto.senhaCertificado, file);
  }

  @Get()
  @Roles('admin', 'manager', 'user')
  @ApiOperation({ summary: 'List empresas' })
  list(@Query('q') q?: string, @Query('limit') limit?: number) {
    return this.empresas.list({ q, limit });
  }

  @Get('cnpj/:cnpj')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({ summary: 'Get empresa by CNPJ' })
  async getByCnpj(@Param('cnpj') cnpj: string) {
    const doc = await this.empresas.getByCnpj(cnpj);
    if (!doc) return { found: false };
    return doc;
  }

  @Get(':id')
  @Roles('admin', 'manager', 'user')
  @ApiOperation({ summary: 'Get empresa by id' })
  async getById(@Param('id') id: string) {
    const doc = await this.empresas.getById(id);
    if (!doc) return { found: false };
    return doc;
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update empresa' })
  @ApiBody({ type: UpdateEmpresaDto })
  update(@Param('id') id: string, @Body() dto: UpdateEmpresaDto) {
    return this.empresas.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete empresa' })
  remove(@Param('id') id: string) {
    return this.empresas.remove(id);
  }
}
