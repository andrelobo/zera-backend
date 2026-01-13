import { Inject, Injectable } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types'
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository'

@Injectable()
export class EmitirNfseService {
  constructor(
    @Inject('FiscalProvider')
    private readonly provider: FiscalProvider,
    private readonly repository: NfseEmissionRepository,
  ) {}

  async execute(input: EmitirNfseInput) {
    const emission = await this.repository.create({
      provider: 'PLUGNOTAS',
      prestadorCnpj: input.prestador.cnpj,
      tomadorDocumento: input.tomador.cpfCnpj,
      payload: input,
    })

    const result = await this.provider.emitirNfse(input)

    return {
      emissionId: emission.id,
      result,
    }
  }
}
