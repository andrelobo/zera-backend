import { Injectable, Logger } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types'
import type { EmitirNfseResult } from '../domain/types/emitir-nfse.result'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'
import { getNuvemFiscalConfig } from './nuvemfiscal/nuvemfiscal.config'
import { NfseApi } from './nuvemfiscal/nfse.api'

@Injectable()
export class NuvemFiscalProvider implements FiscalProvider {
  private readonly logger = new Logger(NuvemFiscalProvider.name)

  constructor(private readonly nfseApi: NfseApi) {}

  async emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResult> {
    const cfg = getNuvemFiscalConfig()

    const ambiente = cfg.environment === 'production' ? 'producao' : 'homologacao'

    const payload = {
      ambiente,
      referencia: input.referenciaExterna,
      prestador: {
        cnpj: input.prestador.cnpj,
        inscricao_municipal: input.prestador.inscricaoMunicipal,
        razao_social: input.prestador.razaoSocial,
        endereco: {
          logradouro: input.prestador.endereco.logradouro,
          numero: input.prestador.endereco.numero,
          bairro: input.prestador.endereco.bairro,
          municipio: input.prestador.endereco.municipio,
          uf: input.prestador.endereco.uf,
          cep: input.prestador.endereco.cep,
        },
      },
      tomador: {
        cpf_cnpj: input.tomador.cpfCnpj,
        razao_social: input.tomador.razaoSocial,
        email: input.tomador.email,
        endereco: {
          logradouro: input.tomador.endereco.logradouro,
          numero: input.tomador.endereco.numero,
          bairro: input.tomador.endereco.bairro,
          municipio: input.tomador.endereco.municipio,
          uf: input.tomador.endereco.uf,
          cep: input.tomador.endereco.cep,
        },
      },
      servico: {
        codigo_municipal: input.servico.codigoMunicipal,
        descricao: input.servico.descricao,
        valor: input.servico.valor,
      },
    }

    this.logger.log('Emitindo NFS-e via NuvemFiscal', {
      prestador: input.prestador.cnpj,
      tomador: input.tomador.cpfCnpj,
      referenciaExterna: input.referenciaExterna,
      ambiente,
    })

    const response = await this.nfseApi.emitirDps(payload as any)

    return {
      status: NfseEmissionStatus.PENDING,
      provider: 'NUVEMFISCAL',
      externalId: response.id,
      providerResponse: response as any,
    }
  }
}
