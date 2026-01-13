import { Body, Controller, Post } from '@nestjs/common'
import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { EmitirNfseDto } from './dtos/emitir-nfse.dto'
import type { EmitirNfseInput } from '../../fiscal/domain/types/emitir-nfse.types'

@Controller('nfse')
export class FiscalController {
  constructor(
    private readonly emitirNfseService: EmitirNfseService,
  ) {}

  @Post('emitir')
  emitir(@Body() dto: EmitirNfseDto) {
    const input: EmitirNfseInput = {
      prestador: dto.prestador,
      tomador: dto.tomador,
      servico: dto.servico,
      referenciaExterna: dto.referenciaExterna,
    }

    return this.emitirNfseService.execute(input)
  }
}
