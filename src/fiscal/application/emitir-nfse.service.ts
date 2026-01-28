import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types'
import type { EmitirNfseResult } from '../domain/types/emitir-nfse.result'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository'

@Injectable()
export class EmitirNfseService {
  constructor(
    @Inject('FiscalProvider')
    private readonly provider: FiscalProvider,
    private readonly repository: NfseEmissionRepository,
  ) {}

  async execute(input: EmitirNfseInput): Promise<{
    emissionId: string
    result: EmitirNfseResult
  }> {
    const tomadorEndereco = input?.tomador?.endereco
    if (!tomadorEndereco) {
      throw new BadRequestException({
        message: 'tomador.endereco is required',
      })
    }

    const requiredTomadorEnderecoFields = [
      'logradouro',
      'numero',
      'bairro',
      'municipio',
      'uf',
      'cep',
    ] as const
    const missingFields = requiredTomadorEnderecoFields.filter((field) => !tomadorEndereco[field])
    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'tomador.endereco is missing required fields',
        missingFields,
      })
    }

    const emission = await this.repository.create({
      provider: this.provider.providerName,
      status: NfseEmissionStatus.PENDING,
      payload: input,
    })

    try {
      const result = await this.provider.emitirNfse(input)

      await this.repository.updateEmission(emission._id.toString(), {
        provider: result.provider,
        status: result.status,
        externalId: result.externalId ?? undefined,
        providerResponse: result.providerResponse ?? undefined,
      })

      return {
        emissionId: emission._id.toString(),
        result,
      }
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error)
      await this.repository.updateEmission(emission._id.toString(), {
        status: NfseEmissionStatus.ERROR,
        error: msg,
      })

      const status = error?.status
      const body = error?.body

      if (typeof status === 'number' && status >= 400 && status < 500) {
        throw new BadRequestException({
          message: `${this.provider.providerName} rejected the request`,
          provider: body ?? null,
        })
      }

      throw error
    }
  }
}
