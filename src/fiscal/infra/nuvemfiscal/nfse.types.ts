export type NuvemFiscalAmbiente = 'homologacao' | 'producao'

export type NfseDpsRequest = {
  ambiente: NuvemFiscalAmbiente
  referencia?: string
  infDPS: {
    dhEmi: string
    prest: {
      CNPJ?: string
      CPF?: string | null
      IM?: string
      xNome?: string
    }
    toma?: {
      CPF?: string
      CNPJ?: string
      xNome?: string
      email?: string
      end?: {
        xLgr?: string
        nro?: string
        xBairro?: string
        cMun?: string
        xMun?: string
        UF?: string
        CEP?: string
      }
    }
    serv: {
      cServ: {
        cTribNac?: string
        xDescServ?: string
        cCnae?: string
      }
    }
    valores: {
      vServPrest: {
        vServ: number
      }
      trib?: {
        tribMun?: {
          tribISSQN?: number
        }
      }
    }
  }
}

export type NfseResponse = {
  id: string
  ambiente?: NuvemFiscalAmbiente
  referencia?: string
  status?: string
  created_at?: string
  updated_at?: string
  dados?: unknown
}

export type NfseConsultaResponse = NfseResponse
