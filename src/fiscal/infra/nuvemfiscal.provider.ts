import { Injectable, Logger } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types'
import type { EmitirNfseResult } from '../domain/types/emitir-nfse.result'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'

@Injectable()
export class NuvemFiscalProvider implements FiscalProvider {
  private readonly logger = new Logger(NuvemFiscalProvider.name)

  async emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResult> {
    this.logger.log('Emitindo NFS-e via NuvemFiscal (stub)', {
      prestador: input.prestador.cnpj,
      tomador: input.tomador.cpfCnpj,
      referenciaExterna: input.referenciaExterna,
    })

    const externalId = `nf-${Date.now()}`

    return {
      status: NfseEmissionStatus.PENDING,
      provider: 'NUVEMFISCAL',
      externalId,
    }
  }
}
