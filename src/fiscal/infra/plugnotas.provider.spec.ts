import { PlugNotasProvider } from './plugnotas.provider'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'

describe('PlugNotasProvider', () => {
  const originalCmun = process.env.NFSE_CMUN_IBGE

  beforeEach(() => {
    process.env.NFSE_CMUN_IBGE = '1302603'
  })

  afterEach(() => {
    process.env.NFSE_CMUN_IBGE = originalCmun
  })

  it('treats HTTP 400 with protocol as accepted (PENDING)', async () => {
    const nfseApi = {
      emitirNfse: jest.fn().mockRejectedValue({
        status: 400,
        body: { protocol: 'pn-123' },
      }),
    }

    const provider = new PlugNotasProvider(nfseApi as any)

    const result = await provider.emitirNfse({
      referenciaExterna: 'ref-1',
      prestador: {
        cnpj: '43.521.115/0001-34',
        inscricaoMunicipal: '51754301',
        razaoSocial: 'BURGUS LTDA',
        endereco: {
          logradouro: 'Saldanha Marinho',
          numero: '606',
          bairro: 'Centro',
          municipio: 'Manaus',
          uf: 'AM',
          cep: '69010040',
        },
      },
      tomador: {
        cpfCnpj: '61020788100',
        razaoSocial: 'ANDRE AUGUSTO DE HOLANDA LOBO',
        endereco: {
          logradouro: 'R FREI JOSE DE LEONISSA',
          numero: '758',
          bairro: 'NOVA CIDADE',
          municipio: 'Manaus',
          uf: 'AM',
          cep: '69017020',
        },
      },
      servico: {
        codigoNacional: '171901',
        codigoTributacao: '100',
        descricao: 'Consulta IR 2024',
        valor: 150,
      },
    })

    expect(result.status).toBe(NfseEmissionStatus.PENDING)
    expect(result.externalId).toBe('pn-123')
  })

  it('treats HTTP 400 with protocolo in array as accepted (PENDING)', async () => {
    const nfseApi = {
      emitirNfse: jest.fn().mockRejectedValue({
        status: 400,
        body: [{ protocolo: 'pn-456' }],
      }),
    }

    const provider = new PlugNotasProvider(nfseApi as any)

    const result = await provider.emitirNfse({
      referenciaExterna: 'ref-2',
      prestador: {
        cnpj: '43.521.115/0001-34',
        inscricaoMunicipal: '51754301',
        razaoSocial: 'BURGUS LTDA',
        endereco: {
          logradouro: 'Saldanha Marinho',
          numero: '606',
          bairro: 'Centro',
          municipio: 'Manaus',
          uf: 'AM',
          cep: '69010040',
        },
      },
      tomador: {
        cpfCnpj: '61020788100',
        razaoSocial: 'ANDRE AUGUSTO DE HOLANDA LOBO',
        endereco: {
          logradouro: 'R FREI JOSE DE LEONISSA',
          numero: '758',
          bairro: 'NOVA CIDADE',
          municipio: 'Manaus',
          uf: 'AM',
          cep: '69017020',
        },
      },
      servico: {
        codigoNacional: '171901',
        codigoTributacao: '100',
        descricao: 'Consulta IR 2024',
        valor: 150,
      },
    })

    expect(result.status).toBe(NfseEmissionStatus.PENDING)
    expect(result.externalId).toBe('pn-456')
  })
})
