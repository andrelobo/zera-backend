import { Injectable, Logger } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types'
import type { EmitirNfseResult } from '../domain/types/emitir-nfse.result'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'
import { getNuvemFiscalConfig } from './nuvemfiscal/nuvemfiscal.config'
import { NfseApi } from './nuvemfiscal/nfse.api'
import { mapNuvemFiscalStatusToDomain } from './nuvemfiscal/nfse.mapper'

function onlyDigits(v?: string) {
  return (v ?? '').replace(/\D+/g, '')
}

function todayYmd() {
  const d = new Date()
  const yyyy = String(d.getUTCFullYear())
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

@Injectable()
export class NuvemFiscalProvider implements FiscalProvider {
  private readonly logger = new Logger(NuvemFiscalProvider.name)
  readonly providerName = 'NUVEMFISCAL'

  constructor(private readonly nfseApi: NfseApi) {}

  async emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResult> {
    const cfg = getNuvemFiscalConfig()
    const ambiente = cfg.environment === 'production' ? 'producao' : 'homologacao'
    const tpAmb = ambiente === 'producao' ? 1 : 2

    const cnpjPrest = onlyDigits(input.prestador.cnpj)
    const docTom = onlyDigits(input.tomador.cpfCnpj)
    const cMun = process.env.NFSE_CMUN_IBGE

    if (!cMun) {
      this.logger.warn('NFSE_CMUN_IBGE not set (IBGE code). Some municipalities may require it.')
    }

    const payload: any = {
      ambiente,
      referencia: input.referenciaExterna,
      infDPS: {
        tpAmb,
        dhEmi: new Date().toISOString(),
        verAplic: process.env.APP_VERSION ?? 'zera-backend',
        dCompet: todayYmd(),
        prest: {
          CNPJ: cnpjPrest,
        },
        toma: {
          orgaoPublico: false,
          ...(docTom.length === 11 ? { CPF: docTom } : { CNPJ: docTom }),
          xNome: input.tomador.razaoSocial,
          email: input.tomador.email,
        },
        serv: {
          cServ: {
            cTribNac: input.servico.codigoMunicipal,
            xDescServ: input.servico.descricao,
          },
        },
        valores: {
          vServPrest: {
            vServ: input.servico.valor,
          },
          trib: {
            tribMun: {
              tribISSQN: 1,
            },
          },
        },
      },
    }

    if (cMun) {
      payload.infDPS.toma.end = {
        endNac: {
          cMun,
          CEP: onlyDigits(input.tomador.endereco.cep),
        },
        xLgr: input.tomador.endereco.logradouro,
        nro: input.tomador.endereco.numero,
        xBairro: input.tomador.endereco.bairro,
      }
    }

    this.logger.log('Emitindo NFS-e via NuvemFiscal', {
      ambiente,
      prestador: cnpjPrest,
      referenciaExterna: input.referenciaExterna,
    })

    const response = await this.nfseApi.emitirDps(payload)

    return {
      status: NfseEmissionStatus.PENDING,
      provider: this.providerName,
      externalId: response.id,
      providerResponse: response as any,
    }
  }

  async consultarNfse(externalId: string): Promise<{
    status: NfseEmissionStatus
    providerResponse: any
  }> {
    const resp = await this.nfseApi.consultarNfse(externalId)
    const status = mapNuvemFiscalStatusToDomain(resp.status)
    return { status, providerResponse: resp }
  }

  baixarXmlNfse(externalId: string): Promise<Uint8Array> {
    return this.nfseApi.baixarXmlNfse(externalId)
  }

  baixarPdfNfse(
    externalId: string,
    query?: { logotipo?: boolean; mensagem_rodape?: string },
  ): Promise<Uint8Array> {
    return this.nfseApi.baixarPdfNfse(externalId, query)
  }
}
