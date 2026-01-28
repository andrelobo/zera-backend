import { Injectable, Logger } from '@nestjs/common'
import { PlugNotasHttp } from './plugnotas.http'
import { getPlugNotasConfig } from './plugnotas.config'

const logger = new Logger('PlugNotasNfseApi')

@Injectable()
export class PlugNotasNfseApi {
  constructor(private readonly http: PlugNotasHttp) {}

  emitirNfse(body: any): Promise<any> {
    logger.log('Emitindo NFS-e via PlugNotas')
    return this.http.request<any>({
      method: 'POST',
      path: '/nfse',
      body,
    })
  }

  consultarNfse(idNotaOrProtocol: string): Promise<any> {
    return this.http.request<any>({
      method: 'GET',
      path: `/nfse/${idNotaOrProtocol}`,
    })
  }

  baixarXmlNfse(idNota: string): Promise<Uint8Array> {
    const cfg = getPlugNotasConfig()
    const path = cfg.nfseXmlPathTemplate.replace('{id}', idNota)
    return this.http.request<Uint8Array>({
      method: 'GET',
      path,
    })
  }

  baixarPdfNfse(
    idNota: string,
    query?: { logotipo?: boolean; mensagem_rodape?: string },
  ): Promise<Uint8Array> {
    const cfg = getPlugNotasConfig()
    const path = cfg.nfsePdfPathTemplate.replace('{id}', idNota)
    return this.http.request<Uint8Array>({
      method: 'GET',
      path,
      query,
    })
  }
}
