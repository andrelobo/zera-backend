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
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { SyncNfseArtifactsService } from '../../fiscal/application/sync-nfse-artifacts.service'
import { EmitirNfseDto } from './dtos/emitir-nfse.dto'
import { EmitirNfseResponseDto } from './dtos/emitir-nfse.response.dto'
import { SyncNfseArtifactsResponseDto } from './dtos/sync-nfse-artifacts.response.dto'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import type { NfseEmissionDocument } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema'
import type { FiscalProvider } from '../../fiscal/domain/fiscal-provider.interface'
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/guards/roles.decorator'

function extractIdNota(providerResponse: any): string | null {
  if (!providerResponse) return null
  const normalized = Array.isArray(providerResponse) ? providerResponse[0] : providerResponse
  const doc = Array.isArray(normalized?.documents) ? normalized.documents[0] : normalized?.documents
  return (
    doc?.id ??
    normalized?.id ??
    normalized?.idNota ??
    normalized?.nota?.id ??
    normalized?.nota?.idNota ??
    null
  )
}

@ApiTags('nfse')
@ApiBearerAuth()
@Controller('nfse')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'user')
export class FiscalController {
  constructor(
    private readonly emitirNfseService: EmitirNfseService,
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
    return this.emitirNfseService.execute(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List NFSe emissions (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'provider', required: false, example: 'plugnotas' })
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
  ) {
    const page = pageRaw ? Number(pageRaw) : 1
    const limit = limitRaw ? Number(limitRaw) : 20
    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException({ code: 'INVALID_PAGE', message: 'page must be >= 1' })
    }
    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException({ code: 'INVALID_LIMIT', message: 'limit must be >= 1' })
    }

    const statusFilter =
      status && Object.values(NfseEmissionStatus).includes(status as NfseEmissionStatus)
        ? (status as NfseEmissionStatus)
        : undefined

    if (status && !statusFilter) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `invalid status: ${status}`,
      })
    }

    const result = await this.repo.findPaginated({
      page,
      limit,
      provider: provider?.trim() || undefined,
      status: statusFilter,
    })

    return {
      items: result.items.map((doc) => ({
        id: doc._id.toString(),
        provider: doc.provider,
        status: doc.status,
        externalId: doc.externalId ?? null,
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
    }
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
    const user = (req as any)?.user
    const requestedBy = user?.email ?? user?.sub ?? null
    const ip = req.ip ?? null
    return this.syncNfseArtifactsService.execute({ emissionId: id, requestedBy, ip })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get emission by id' })
  async getById(@Param('id') id: string) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
    }

    return {
      id: doc._id.toString(),
      provider: doc.provider,
      status: doc.status,
      externalId: doc.externalId ?? null,
      createdAt: (doc as any).createdAt ?? null,
      updatedAt: (doc as any).updatedAt ?? null,
      error: doc.error ?? null,
    }
  }

  @Get('external/:externalId')
  @ApiOperation({ summary: 'Get emission by externalId' })
  async getByExternalId(@Param('externalId') externalId: string) {
    const doc = (await this.repo.findByExternalId(externalId)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
    }

    return {
      id: doc._id.toString(),
      provider: doc.provider,
      status: doc.status,
      externalId: doc.externalId ?? null,
      createdAt: (doc as any).createdAt ?? null,
      updatedAt: (doc as any).updatedAt ?? null,
      error: doc.error ?? null,
    }
  }

  @Get('external/:externalId/provider-response')
  @ApiOperation({ summary: 'Get provider response by externalId' })
  async getProviderResponseByExternalId(@Param('externalId') externalId: string) {
    const doc = (await this.repo.findByExternalId(externalId)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
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
    }
  }

  @Get(':id/provider-response')
  @ApiOperation({ summary: 'Get provider response for emission' })
  async getProviderResponse(@Param('id') id: string) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
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
    }
  }

  @Get(':id/artifacts')
  @ApiOperation({ summary: 'Get artifacts info' })
  async getArtifacts(@Param('id') id: string) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
    }

    return {
      id: doc._id.toString(),
      externalId: doc.externalId ?? null,
      hasXml: Boolean(doc.xmlBase64),
      hasPdf: Boolean(doc.pdfBase64),
      status: doc.status,
      updatedAt: (doc as any).updatedAt ?? null,
    }
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Download XML' })
  @ApiProduces('application/xml')
  async downloadXml(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
    }

    if (!doc.xmlBase64) {
      throw new NotFoundException({ code: 'XML_NOT_AVAILABLE', message: 'XML not available for this emission' })
    }

    const buf = Buffer.from(doc.xmlBase64, 'base64')
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfse-${doc.externalId ?? doc._id.toString()}.xml"`,
    )
    return res.send(buf)
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download PDF' })
  @ApiProduces('application/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
    }

    if (!doc.pdfBase64) {
      throw new NotFoundException({ code: 'PDF_NOT_AVAILABLE', message: 'PDF not available for this emission' })
    }

    const buf = Buffer.from(doc.pdfBase64, 'base64')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfse-${doc.externalId ?? doc._id.toString()}.pdf"`,
    )
    return res.send(buf)
  }

  @Get(':id/remote/xml')
  @ApiOperation({ summary: 'Download XML directly from provider (by idNota)' })
  @ApiProduces('application/xml')
  async downloadXmlFromProvider(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
    }

    const idNota = extractIdNota(doc.providerResponse)
    if (!idNota) {
      throw new BadRequestException({
        code: 'ID_NOTA_NOT_FOUND',
        message: 'idNota not found in providerResponse',
      })
    }

    const buf = await this.provider.baixarXmlNfse(idNota)
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${idNota}.xml"`)
    return res.send(Buffer.from(buf))
  }

  @Get(':id/remote/pdf')
  @ApiOperation({ summary: 'Download PDF directly from provider (by idNota)' })
  @ApiProduces('application/pdf')
  async downloadPdfFromProvider(@Param('id') id: string, @Res() res: Response) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) {
      throw new NotFoundException({ code: 'EMISSION_NOT_FOUND', message: 'Emission not found' })
    }

    const idNota = extractIdNota(doc.providerResponse)
    if (!idNota) {
      throw new BadRequestException({
        code: 'ID_NOTA_NOT_FOUND',
        message: 'idNota not found in providerResponse',
      })
    }

    const buf = await this.provider.baixarPdfNfse(idNota)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${idNota}.pdf"`)
    return res.send(Buffer.from(buf))
  }
}
