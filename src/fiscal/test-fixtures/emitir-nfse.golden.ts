import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types';

export const goldenEmitirNfseInput: EmitirNfseInput = {
  referenciaExterna: 'nfse-idem-001',
  localPrestacao: {
    pais: 'Brasil',
    uf: 'AM',
    municipio: 'Manaus',
  },
  prestador: {
    cnpj: '43521115000134',
    razaoSocial: 'BURGUS LTDA',
    inscricaoMunicipal: '51754301',
    endereco: {
      logradouro: 'Rua Saldanha Marinho',
      numero: '606',
      bairro: 'Centro',
      municipio: 'Manaus',
      uf: 'AM',
      cep: '69010040',
    },
  },
  tomador: {
    cpfCnpj: '61020788100',
    razaoSocial: 'Cliente Exemplo',
    inscricaoMunicipal: '998877',
    email: 'cliente@example.com',
    endereco: {
      logradouro: 'Rua Exemplo',
      numero: '100',
      bairro: 'Centro',
      municipio: 'Manaus',
      uf: 'AM',
      cep: '69010000',
    },
  },
  servico: {
    codigoMunicipal: '040101',
    codigoNacional: '171901',
    codigoTributacao: '100',
    descricao: 'Servico',
    valor: 100,
    tributacaoTotal: {
      federal: { valor: 5 },
      estadual: { valor: 0 },
      municipal: { valor: 2.01 },
    },
  },
};

export const goldenExpectedProviderContract = {
  codigoServicoNacional: '171901',
  codigoTributacao: '100',
  cnpjPrestador: '43521115000134',
  inscricaoMunicipalPrestador: '51754301',
  documentoTomador: '61020788100',
  valorServico: 100,
} as const;
