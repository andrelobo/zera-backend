import { Injectable, Logger } from '@nestjs/common'
import { PlugNotasHttp } from './plugnotas.http'
import { getPlugNotasConfig } from './plugnotas.config'

@Injectable()
export class PlugNotasCnpjApi {
  private readonly logger = new Logger(PlugNotasCnpjApi.name)

  constructor(private readonly http: PlugNotasHttp) {}

  consultarCnpj(cnpj: string): Promise<any> {
    const cfg = getPlugNotasConfig()
    const path = cfg.cnpjPathTemplate.replace('{cnpj}', cnpj)
    this.logger.log({ cnpj }, 'Consultando CNPJ na PlugNotas')
    return this.http.request<any>({
      method: 'GET',
      path,
    })
  }
}
