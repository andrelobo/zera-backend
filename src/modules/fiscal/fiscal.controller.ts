import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { EmitirNfseDto } from './dtos/emitir-nfse.dto'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import type { NfseEmissionDocument } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema'

@Controller('nfse')
export class FiscalController {
  constructor(
    private readonly emitirNfseService: EmitirNfseService,
    private readonly repo: NfseEmissionRepository,
  ) {}

  @Post('emitir')
  emitir(@Body() dto: EmitirNfseDto) {
    return this.emitirNfseService.execute(dto)
  }

  @Get(':id')
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

  @Get(':id/provider-response')
  async getProviderResponse(@Param('id') id: string) {
    const doc = (await this.repo.findById(id)) as NfseEmissionDocument | null
    if (!doc) return { found: false }

    return {
      found: true,
      id: doc._id.toString(),
      provider: doc.provider,
      externalId: doc.externalId ?? null,
      status: doc.status,
      providerResponse: doc.providerResponse ?? null,
      error: doc.error ?? null,
      createdAt: (doc as any).createdAt ?? null,
      updatedAt: (doc as any).updatedAt ?? null,
    }
  }

  @Get(':id/artifacts')
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
}
