export interface EmitirNfseInput {
  prestador: {
    cnpj: string
    inscricaoMunicipal?: string
    razaoSocial: string
    regimeTributarioSn?: {
      opSimpNac?: number
      regApTribSN?: number
      regEspTrib?: number
    }
    endereco: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      municipio: string
      uf: string
      cep: string
    }
  }

  tomador: {
    cpfCnpj: string
    razaoSocial: string
    inscricaoMunicipal?: string
    email?: string
    endereco: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      municipio: string
      uf: string
      cep: string
    }
  }

  servico: {
    codigoMunicipal?: string
    codigoNacional?: string
    codigoTributacao?: string
    descricao: string
    valor: number
    iss?: {
      tipoTributacao?: number
      exigibilidade?: number
      retido?: boolean
      aliquota?: number
    }
    tributacaoTotal?: {
      federal?: {
        valor?: number
        valorPercentual?: number
      }
      estadual?: {
        valor?: number
        valorPercentual?: number
      }
      municipal?: {
        valor?: number
        valorPercentual?: number
      }
    }
  }

  referenciaExterna: string
}
