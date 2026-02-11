import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger'
import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { SyncNfseArtifactsService } from '../../fiscal/application/sync-nfse-artifacts.service'
import { EmitirNfseDto } from './dtos/emitir-nfse.dto'
import { EmitirNfseResponseDto } from './dtos/emitir-nfse.response.dto'
import { SyncNfseArtifactsResponseDto } from './dtos/sync-nfse-artifacts.response.dto'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import type { NfseEmissionDocument } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema'
import type { FiscalProvider } from '../../fiscal/domain/fiscal-provider.interface'

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
    if (!doc) return { found: false }

    return {
      found: true,
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
    if (!doc) return { found: false }

    return {
      found: true,
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
    if (!doc) return { found: false }

    return {
      found: true,
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
    if (!doc) return { found: false }

    return {
      found: true,
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
    if (!doc) return { found: false }

    return {
      found: true,
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
    if (!doc) return res.status(404).json({ found: false })

    if (!doc.xmlBase64) {
      return res.status(404).json({ found: true, hasXml: false })
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
    if (!doc) return res.status(404).json({ found: false })

    if (!doc.pdfBase64) {
      return res.status(404).json({ found: true, hasPdf: false })
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
    if (!doc) return res.status(404).json({ found: false })

    const idNota = extractIdNota(doc.providerResponse)
    if (!idNota) {
      return res.status(400).json({ found: true, message: 'idNota not found in providerResponse' })
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
    if (!doc) return res.status(404).json({ found: false })

    const idNota = extractIdNota(doc.providerResponse)
    if (!idNota) {
      return res.status(400).json({ found: true, message: 'idNota not found in providerResponse' })
    }

    const buf = await this.provider.baixarPdfNfse(idNota)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${idNota}.pdf"`)
    return res.send(Buffer.from(buf))
  }
}
