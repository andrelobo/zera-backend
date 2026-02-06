export interface EmitirNfseInput {
  prestador: {
    cnpj: string
    inscricaoMunicipal?: string
    razaoSocial: string
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
  }

  referenciaExterna: string
}
