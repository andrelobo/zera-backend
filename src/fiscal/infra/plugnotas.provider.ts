import { Injectable, Logger } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types'
import type { EmitirNfseResult } from '../domain/types/emitir-nfse.result'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'
import { PlugNotasNfseApi } from './plugnotas/nfse.api'
import { extractPlugNotasStatus, mapPlugNotasStatusToDomain } from './plugnotas/nfse.mapper'

function onlyDigits(v?: string) {
  return (v ?? '').replace(/\D+/g, '')
}

function compact<T extends Record<string, any>>(value: T): T {
  const out: Record<string, any> = Array.isArray(value) ? [] : {}
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out as T
}

function toDecimalString(value: number): string {
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

function hasAcceptedProtocolOnBadRequest(body: any): boolean {
  const first = Array.isArray(body) ? body[0] : body
  return !!(first?.protocol || first?.protocolo)
}

function normalizeServicoCodigo(input: EmitirNfseInput['servico']): string {
  const raw = input.codigoNacional ?? input.codigoMunicipal
  const digits = onlyDigits(raw)
  if (digits.length !== 6) {
    throw new Error('servico.codigo must contain exactly 6 digits for NFSe Nacional')
  }
  return digits
}

@Injectable()
export class PlugNotasProvider implements FiscalProvider {
  readonly providerName = 'PLUGNOTAS'
  private readonly logger = new Logger(PlugNotasProvider.name)

  constructor(private readonly nfseApi: PlugNotasNfseApi) {}

  async emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResult> {
    const cnpjPrest = onlyDigits(input.prestador.cnpj)
    const docTom = onlyDigits(input.tomador.cpfCnpj)
    const cMun = process.env.NFSE_CMUN_IBGE

    if (!cMun) {
      throw new Error('NFSE_CMUN_IBGE not set (IBGE code required for PlugNotas)')
    }

    const servicoCodigo = normalizeServicoCodigo(input.servico)
    const regimeTributarioSn = input.prestador.regimeTributarioSn
      ? compact({
          opSimpNac: input.prestador.regimeTributarioSn.opSimpNac,
          regApTribSN: input.prestador.regimeTributarioSn.regApTribSN,
          regEspTrib: input.prestador.regimeTributarioSn.regEspTrib,
        })
      : undefined
    const regimeApuracaoTributaria = regimeTributarioSn?.regApTribSN
      ? regimeTributarioSn.regApTribSN
      : undefined

    const payload = [
      compact({
        idIntegracao: input.referenciaExterna,
        regimeApuracaoTributaria,
        emitente: {
          tipo: cnpjPrest.length === 14 ? 1 : 2,
          codigoCidade: cMun,
          inscricaoMunicipal: input.prestador.inscricaoMunicipal,
        },
        prestador: {
          cpfCnpj: cnpjPrest,
          inscricaoMunicipal: input.prestador.inscricaoMunicipal,
          opSimpNac: regimeTributarioSn?.opSimpNac,
          regApTribSN: regimeTributarioSn?.regApTribSN,
          regEspTrib: regimeTributarioSn?.regEspTrib,
          regimeTributarioSn,
          regTrib: regimeTributarioSn,
        },
        tomador: compact({
          cpfCnpj: docTom,
          razaoSocial: input.tomador.razaoSocial,
          inscricaoMunicipal: input.tomador.inscricaoMunicipal,
          email: input.tomador.email,
          endereco: compact({
            descricaoCidade: input.tomador.endereco.municipio,
            cep: onlyDigits(input.tomador.endereco.cep),
            tipoLogradouro: 'Rua',
            logradouro: input.tomador.endereco.logradouro,
            tipoBairro: 'Centro',
            codigoCidade: cMun,
            complemento: input.tomador.endereco.complemento,
            estado: input.tomador.endereco.uf,
            numero: input.tomador.endereco.numero,
            bairro: input.tomador.endereco.bairro,
          }),
        }),
        servico: [
          compact({
            codigo: servicoCodigo,
            codigoTributacao: input.servico.codigoTributacao,
            discriminacao: input.servico.descricao,
            iss: input.servico.iss,
            valor: {
              servico: Number(toDecimalString(input.servico.valor)),
            },
            tributacaoTotal: input.servico.tributacaoTotal,
          }),
        ],
      }),
    ]

    if (process.env.PLUGNOTAS_DEBUG_PAYLOAD === 'true') {
      this.logger.warn('PlugNotas payload debug enabled', { payload })
    }

    this.logger.log('Emitindo NFS-e via PlugNotas', {
      prestador: cnpjPrest,
      referenciaExterna: input.referenciaExterna,
    })

    let response: any
    try {
      response = await this.nfseApi.emitirNfse(payload)
    } catch (error: any) {
      const status = error?.status
      const body = error?.body
      // Some PlugNotas responses return HTTP 400 but include a valid protocol/protocolo.
      if (status === 400 && hasAcceptedProtocolOnBadRequest(body)) {
        this.logger.warn('PlugNotas returned 400 with protocol/protocolo; treating as PENDING')
        response = body
      } else {
        throw error
      }
    }
    const first = Array.isArray(response) ? response[0] : response
    const status = mapPlugNotasStatusToDomain(extractPlugNotasStatus(first))
    const externalId =
      first?.idNota ??
      first?.id ??
      first?.protocolo ??
      first?.protocol ??
      first?.idIntegracao ??
      input.referenciaExterna

    return {
      status: status ?? NfseEmissionStatus.PENDING,
      provider: this.providerName,
      externalId,
      providerResponse: response as any,
      providerRequest: { payload },
    }
  }

  async consultarNfse(externalId: string): Promise<{
    status: NfseEmissionStatus
    providerResponse: any
  }> {
    const response = await this.nfseApi.consultarNfse(externalId)
    const normalized = Array.isArray(response) ? response[0] : response
    const status = mapPlugNotasStatusToDomain(extractPlugNotasStatus(normalized))
    return { status, providerResponse: response }
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
