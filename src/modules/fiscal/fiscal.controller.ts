import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { EmitirNfseDto } from './dtos/emitir-nfse.dto'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'

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
    const doc = await this.repo.findById(id)
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
}
