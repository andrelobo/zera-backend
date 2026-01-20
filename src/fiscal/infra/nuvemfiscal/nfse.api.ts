import { Injectable } from '@nestjs/common'
import { NuvemFiscalHttp } from './nuvemfiscal.http'
import type { NfseConsultaResponse, NfseDpsRequest, NfseResponse } from './nfse.types'

@Injectable()
export class NfseApi {
  constructor(private readonly http: NuvemFiscalHttp) {}

  emitirDps(body: NfseDpsRequest): Promise<NfseResponse> {
    return this.http.request<NfseResponse>({
      method: 'POST',
      path: '/nfse/dps',
      body,
    })
  }

  consultarNfse(id: string): Promise<NfseConsultaResponse> {
    return this.http.request<NfseConsultaResponse>({
      method: 'GET',
      path: `/nfse/${id}`,
    })
  }

  baixarXmlNfse(id: string): Promise<Uint8Array> {
    return this.http.request<Uint8Array>({
      method: 'GET',
      path: `/nfse/${id}/xml`,
    })
  }

  baixarPdfNfse(
    id: string,
    query?: { logotipo?: boolean; mensagem_rodape?: string },
  ): Promise<Uint8Array> {
    return this.http.request<Uint8Array>({
      method: 'GET',
      path: `/nfse/${id}/pdf`,
      query,
    })
  }
}
