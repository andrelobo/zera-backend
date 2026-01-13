export interface EmitirNfseInput {
  prestador: {
    cnpj: string;
    inscricaoMunicipal?: string;
    razaoSocial: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };

  tomador: {
    cpfCnpj: string;
    razaoSocial: string;
    email?: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
  };

  servico: {
    codigoMunicipal: string;
    descricao: string;
    valor: number;
  };

  referenciaExterna: string;
}

export interface EmitirNfseOutput {
  provider: 'plugnotas';
  protocolo: string;
  status: 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA';
}
