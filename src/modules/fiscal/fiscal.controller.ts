import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiPropertyOptional,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service';
import { EmitirNfseQuickService } from '../../fiscal/application/emitir-nfse-quick.service';
import { ServicoCatalogService } from '../../fiscal/application/servico-catalog.service';
import { SyncNfseArtifactsService } from '../../fiscal/application/sync-nfse-artifacts.service';
import { EmitirNfseDto } from './dtos/emitir-nfse.dto';
import { EmitirNfseQuickDto } from './dtos/emitir-nfse-quick.dto';
import { EmitirNfseResponseDto } from './dtos/emitir-nfse.response.dto';
import { SyncNfseArtifactsResponseDto } from './dtos/sync-nfse-artifacts.response.dto';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import type { NfseEmissionDocument } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema';
import type { FiscalProvider } from '../../fiscal/domain/fiscal-provider.interface';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';

class CancelarNfseDto {
  @ApiPropertyOptional({
    description:
      'Código de cancelamento. NFSe Nacional: 1 (Erro na Emissão), 2 (Serviço não Prestado), 9 (Outros)',
    example: '9',
  })
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Motivo do cancelamento',
    example: 'Cancelamento a pedido do Prestador',
  })
  motivo?: string;
}

function extractIdNota(providerResponse: any): string | null {
  if (!providerResponse) return null;
  const normalized = Array.isArray(providerResponse) ? providerResponse[0] : providerResponse;
  const doc = Array.isArray(normalized?.documents)
    ? normalized.documents[0]
    : normalized?.documents;
  return (
    doc?.id ??
    normalized?.id ??
    normalized?.idNota ??
    normalized?.nota?.id ??
    normalized?.nota?.idNota ??
    null
  );
}

@ApiTags('nfse')
@ApiBearerAuth()
@Controller('nfse')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'user')
export class FiscalController {
  constructor(
    private readonly emitirNfseService: EmitirNfseService,
    private readonly emitirNfseQuickService: EmitirNfseQuickService,
    private readonly servicoCatalog: ServicoCatalogService,
    private readonly syncNfseArtifactsService: SyncNfseArtifactsService,
    private readonly repo: NfseEmissionRepository,
    @Inject('FiscalProvider')
    private readonly provider: FiscalProvider,
  ) {}

  @Post('emitir')
  @ApiOperation({ summary: 'Emitir NFSe (DPS)' })
  @ApiBody({ type: EmitirNfseDto })
  @ApiResponse({ status: 201, type: EmitirNfseResponseDto })
  emitir(@Body() dto: EmitirNfseDto) {
    return this.emitirNfseService.execute(dto);
  }

  @Post('quick')
  @ApiOperation({
    summary: 'Emitir NFSe de forma ultra-simplificada (quick)',
    description:
      'Recebe cnpj, cpfTomador e valor, e opcionalmente codigoServico. Demais campos são inferidos pelo backend.',
  })
  @ApiBody({ type: EmitirNfseQuickDto })
  @ApiResponse({ status: 201, type: EmitirNfseResponseDto })
  emitirQuick(@Body() dto: EmitirNfseQuickDto) {
    return this.emitirNfseQuickService.execute(dto);
  }

  @Post(':id/cancelamento')
  @ApiOperation({
    summary: 'Solicitar cancelamento da NFSe por emissão interna',
    description:
      'Só permite solicitar cancelamento de emissão AUTHORIZED. Se não informado, usa codigo=9 e motivo padrão.',
  })
  @ApiBody({ type: CancelarNfseDto, required: false })
  async solicitarCancelamento(@Param('id') id: string, @Body() body?: CancelarNfseDto) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    if (doc.status !== NfseEmissionStatus.AUTHORIZED) {
      throw new BadRequestException({
        code: 'CANCELAMENTO_STATUS_INVALIDO',
        message: 'Somente notas com status AUTHORIZED podem ser canceladas',
      });
    }

    const idNota = extractIdNota(doc.providerResponse) ?? doc.externalId ?? null;
    if (!idNota) {
      throw new BadRequestException({
        code: 'ID_NOTA_NOT_FOUND',
        message: 'idNota not found in provider response',
      });
    }

    const codigo = body?.codigo?.trim() || '9';
    const motivo = body?.motivo?.trim() || 'Cancelamento a pedido do Prestador';
    const result = await this.provider.solicitarCancelamentoNfse(idNota, { codigo, motivo });

    const nextProviderResponse = {
      ...(doc.providerResponse as Record<string, unknown> | null),
      cancelamento: {
        solicitadoEm: new Date().toISOString(),
        codigo,
        motivo,
        protocol: result.protocol,
        response: result.providerResponse,
      },
    };

    await this.repo.updateEmission(id, {
      providerResponse: nextProviderResponse as Record<string, any>,
    });

    return {
      id: doc._id.toString(),
      externalId: doc.externalId ?? null,
      idNota,
      cancellationProtocol: result.protocol,
      providerResponse: result.providerResponse,
    };
  }

  @Get('cancelamento/:cancellationProtocol')
  @ApiOperation({ summary: 'Consultar solicitação de cancelamento da NFSe' })
  async consultarCancelamento(@Param('cancellationProtocol') cancellationProtocol: string) {
    if (!cancellationProtocol?.trim()) {
      throw new BadRequestException({
        code: 'INVALID_CANCELLATION_PROTOCOL',
        message: 'cancellationProtocol is required',
      });
    }

    const result = await this.provider.consultarSolicitacaoCancelamentoNfse(
      cancellationProtocol.trim(),
    );

    return {
      cancellationProtocol: cancellationProtocol.trim(),
      status: result.status ?? null,
      providerResponse: result.providerResponse,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List NFSe emissions (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'provider', required: false, example: 'plugnotas' })
  @ApiQuery({ name: 'dateFrom', required: false, example: '2026-02-01' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      NfseEmissionStatus.PENDING,
      NfseEmissionStatus.AUTHORIZED,
      NfseEmissionStatus.REJECTED,
      NfseEmissionStatus.CANCELED,
      NfseEmissionStatus.ERROR,
    ],
  })
  async list(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('provider') provider?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFromRaw?: string,
  ) {
    const page = pageRaw ? Number(pageRaw) : 1;
    const limit = limitRaw ? Number(limitRaw) : 20;
    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException({ code: 'INVALID_PAGE', message: 'page must be >= 1' });
    }
    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException({ code: 'INVALID_LIMIT', message: 'limit must be >= 1' });
    }

    const statusFilter =
      status && Object.values(NfseEmissionStatus).includes(status as NfseEmissionStatus)
        ? (status as NfseEmissionStatus)
        : undefined;

    if (status && !statusFilter) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `invalid status: ${status}`,
      });
    }

    let createdFrom: Date | undefined;
    if (dateFromRaw?.trim()) {
      const parsed = new Date(dateFromRaw.trim());
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException({
          code: 'INVALID_DATE_FROM',
          message: 'dateFrom must be a valid date (e.g., 2026-02-01)',
        });
      }
      createdFrom = parsed;
    }

    const result = await this.repo.findPaginated({
      page,
      limit,
      provider: provider?.trim() || undefined,
      status: statusFilter,
      createdFrom,
    });

    return {
      items: result.items.map((doc) => ({
        id: doc._id.toString(),
        provider: doc.provider,
        status: doc.status,
        externalId: doc.externalId ?? null,
        empresaCnpj: doc.empresaCnpj ?? null,
        tomadorCpfCnpj: doc.tomadorCpfCnpj ?? null,
        tomadorRazaoSocial: doc.tomadorRazaoSocial ?? null,
        codigoServico: doc.codigoServico ?? null,
        descricaoServico: doc.descricaoServico ?? null,
        valorServico: doc.valorServico ?? null,
        aliquotaIss: doc.aliquotaIss ?? null,
        valorIss: doc.valorIss ?? null,
        createdAt: (doc as any).createdAt ?? null,
        updatedAt: (doc as any).updatedAt ?? null,
        error: doc.error ?? null,
      })),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('servicos/autocomplete')
  @ApiOperation({ summary: 'Autocomplete de servicos (catalogo LC116/NFS-e Nacional)' })
  @ApiQuery({ name: 'q', required: false, example: 'barbearia' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  autocompleteServicos(@Query('q') q?: string, @Query('limit') limitRaw?: string) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException({ code: 'INVALID_LIMIT', message: 'limit must be >= 1' });
    }

    const items = this.servicoCatalog.autocomplete({ q, limit }).map((item) => ({
      codigoServico: item.codigoNacional,
      itemLc116: item.itemLc116,
      sequencial: item.sequencial,
      descricao: item.descricao,
    }));

    return { items, total: items.length };
  }

  @Get('servicos')
  @ApiOperation({ summary: 'Listagem paginada de servicos do catalogo LC116/NFS-e Nacional' })
  @ApiQuery({ name: 'q', required: false, example: 'manutencao' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  listServicos(
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('page') pageRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    const page = pageRaw ? Number(pageRaw) : 1;

    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException({ code: 'INVALID_LIMIT', message: 'limit must be >= 1' });
    }
    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException({ code: 'INVALID_PAGE', message: 'page must be >= 1' });
    }

    const result = this.servicoCatalog.list({ q, limit, page });
    return {
      items: result.items.map((item) => ({
        codigoServico: item.codigoNacional,
        itemLc116: item.itemLc116,
        sequencial: item.sequencial,
        descricao: item.descricao,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('servicos/:codigo')
  @ApiOperation({ summary: 'Detalhe de servico por codigo nacional (6 digitos)' })
  @ApiParam({ name: 'codigo', example: '060101' })
  getServicoByCodigo(@Param('codigo') codigo: string) {
    if (!/^\d{6}$/.test(codigo)) {
      throw new BadRequestException({
        code: 'INVALID_CODIGO_SERVICO',
        message: 'codigo deve conter exatamente 6 digitos',
      });
    }

    const item = this.servicoCatalog.findByCodigo(codigo);
    if (!item) {
      throw new NotFoundException({
        code: 'SERVICO_NOT_FOUND',
        message: 'Servico nao encontrado no catalogo nacional (LC116)',
      });
    }

    return {
      codigoServico: item.codigoNacional,
      itemLc116: item.itemLc116,
      sequencial: item.sequencial,
      descricao: item.descricao,
    };
  }

  @Post(':id/sync-artifacts')
  @ApiOperation({
    summary: 'Sync XML/PDF artifacts on demand',
    description:
      'Idempotent manual recovery endpoint. Keeps polling for PENDING as default flow and does not reopen ERROR to PENDING.',
  })
  @ApiResponse({ status: 200, type: SyncNfseArtifactsResponseDto })
  @ApiResponse({ status: 429, description: 'Rate limited for this emission' })
  async syncArtifacts(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any)?.user;
    const requestedBy = user?.email ?? user?.sub ?? null;
    const ip = req.ip ?? null;
    return this.syncNfseArtifactsService.execute({ emissionId: id, requestedBy, ip });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get emission by id' })
  async getById(@Param('id') id: string) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    return {
      id: doc._id.toString(),
      provider: doc.provider,
      status: doc.status,
      externalId: doc.externalId ?? null,
      empresaCnpj: doc.empresaCnpj ?? null,
      tomadorCpfCnpj: doc.tomadorCpfCnpj ?? null,
      tomadorRazaoSocial: doc.tomadorRazaoSocial ?? null,
      codigoServico: doc.codigoServico ?? null,
      descricaoServico: doc.descricaoServico ?? null,
      valorServico: doc.valorServico ?? null,
      aliquotaIss: doc.aliquotaIss ?? null,
      valorIss: doc.valorIss ?? null,
      createdAt: (doc as any).createdAt ?? null,
      updatedAt: (doc as any).updatedAt ?? null,
      error: doc.error ?? null,
    };
  }

  @Get('external/:externalId')
  @ApiOperation({ summary: 'Get emission by externalId' })
  async getByExternalId(@Param('externalId') externalId: string) {
    const doc = (await this.repo.findByExternalId(externalId)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    return {
      id: doc._id.toString(),
      provider: doc.provider,
      status: doc.status,
      externalId: doc.externalId ?? null,
      empresaCnpj: doc.empresaCnpj ?? null,
      tomadorCpfCnpj: doc.tomadorCpfCnpj ?? null,
      tomadorRazaoSocial: doc.tomadorRazaoSocial ?? null,
      codigoServico: doc.codigoServico ?? null,
      descricaoServico: doc.descricaoServico ?? null,
      valorServico: doc.valorServico ?? null,
      aliquotaIss: doc.aliquotaIss ?? null,
      valorIss: doc.valorIss ?? null,
      createdAt: (doc as any).createdAt ?? null,
      updatedAt: (doc as any).updatedAt ?? null,
      error: doc.error ?? null,
    };
  }

  @Get('external/:externalId/provider-response')
  @ApiOperation({ summary: 'Get provider response by externalId' })
  async getProviderResponseByExternalId(@Param('externalId') externalId: string) {
    const doc = (await this.repo.findByExternalId(externalId)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    return {
      id: doc._id.toString(),
      provider: doc.provider,
      externalId: doc.externalId ?? null,
      status: doc.status,
      providerRequest: doc.providerRequest ?? null,
      providerResponse: doc.providerResponse ?? null,
      error: doc.error ?? null,
      createdAt: (doc as any).createdAt ?? null,
      updatedAt: (doc as any).updatedAt ?? null,
    };
  }

  @Get(':id/provider-response')
  @ApiOperation({ summary: 'Get provider response for emission' })
  async getProviderResponse(@Param('id') id: string) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    return {
      id: doc._id.toString(),
      provider: doc.provider,
      externalId: doc.externalId ?? null,
      status: doc.status,
      providerRequest: doc.providerRequest ?? null,
      providerResponse: doc.providerResponse ?? null,
      error: doc.error ?? null,
      createdAt: (doc as any).createdAt ?? null,
      updatedAt: (doc as any).updatedAt ?? null,
    };
  }

  @Get(':id/artifacts')
  @ApiOperation({ summary: 'Get artifacts info' })
  async getArtifacts(@Param('id') id: string) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    return {
      id: doc._id.toString(),
      externalId: doc.externalId ?? null,
      hasXml: Boolean(doc.xmlBase64),
      hasPdf: Boolean(doc.pdfBase64),
      status: doc.status,
      updatedAt: (doc as any).updatedAt ?? null,
    };
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Download XML' })
  @ApiProduces('application/xml')
  async downloadXml(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    if (!doc.xmlBase64) {
      throw new NotFoundException({
        code: 'XML_NOT_AVAILABLE',
        message: 'XML not available for this emission',
      });
    }

    const buf = Buffer.from(doc.xmlBase64, 'base64');
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfse-${doc.externalId ?? doc._id.toString()}.xml"`,
    );
    return res.send(buf);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download PDF' })
  @ApiProduces('application/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    if (!doc.pdfBase64) {
      throw new NotFoundException({
        code: 'PDF_NOT_AVAILABLE',
        message: 'PDF not available for this emission',
      });
    }

    const buf = Buffer.from(doc.pdfBase64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfse-${doc.externalId ?? doc._id.toString()}.pdf"`,
    );
    return res.send(buf);
  }

  @Get(':id/remote/xml')
  @ApiOperation({ summary: 'Download XML directly from provider (by idNota)' })
  @ApiProduces('application/xml')
  async downloadXmlFromProvider(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    const idNota = extractIdNota(doc.providerResponse);
    if (!idNota) {
      throw new BadRequestException({
        code: 'ID_NOTA_NOT_FOUND',
        message: 'idNota not found in providerResponse',
      });
    }

    const buf = await this.provider.baixarXmlNfse(idNota);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${idNota}.xml"`);
    return res.send(Buffer.from(buf));
  }

  @Get(':id/remote/pdf')
  @ApiOperation({ summary: 'Download PDF directly from provider (by idNota)' })
  @ApiProduces('application/pdf')
  async downloadPdfFromProvider(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null;
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' });
    }

    const idNota = extractIdNota(doc.providerResponse);
    if (!idNota) {
      throw new BadRequestException({
        code: 'ID_NOTA_NOT_FOUND',
        message: 'idNota not found in providerResponse',
      });
    }

    const buf = await this.provider.baixarPdfNfse(idNota);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${idNota}.pdf"`);
    return res.send(Buffer.from(buf));
  }
}
