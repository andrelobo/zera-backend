import { Injectable, Logger } from '@nestjs/common'
import { NuvemFiscalHttp } from './nuvemfiscal.http'

const logger = new Logger('CnpjApi')

@Injectable()
export class CnpjApi {
  constructor(private readonly http: NuvemFiscalHttp) {}

  consultarCnpj(cnpj: string): Promise<Record<string, any>> {
    logger.log({ cnpj }, 'Consultando CNPJ na NuvemFiscal')

    return this.http.request<Record<string, any>>({
      method: 'GET',
      path: `/cnpj/${cnpj}`,
    })
  }
}
