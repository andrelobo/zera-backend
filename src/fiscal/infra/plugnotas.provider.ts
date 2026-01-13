import { Injectable, Logger } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types'

@Injectable()
export class PlugNotasProvider implements FiscalProvider {
  private readonly logger = new Logger(PlugNotasProvider.name)

  async emitirNfse(input: EmitirNfseInput): Promise<any> {
    this.logger.log('Emitindo NFS-e via PlugNotas (mock)', {
      prestador: input.prestador.cnpj,
      tomador: input.tomador.cpfCnpj,
    })

    const externalId = `ext-${Date.now()}`

    return {
      status: 'PENDING',
      provider: 'PLUGNOTAS',
      externalId,
    }
  }
}
