import { EmitirNfseService } from './emitir-nfse.service'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'

describe('EmitirNfseService idempotency', () => {
  function makeInput() {
    return {
      referenciaExterna: 'nfse-idem-001',
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
        codigoNacional: '171901',
        descricao: 'Servico',
        valor: 100,
      },
    }
  }

  it('returns existing emission when idempotency key already exists', async () => {
    const existing = {
      _id: { toString: () => 'em-123' },
      status: NfseEmissionStatus.PENDING,
      provider: 'PLUGNOTAS',
      externalId: 'ext-123',
      providerResponse: { protocol: 'ext-123' },
      providerRequest: { payload: [] },
    }

    const repository = {
      findByReference: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      updateEmission: jest.fn(),
    }

    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn(),
    }

    const service = new EmitirNfseService(provider as any, repository as any)
    const output = await service.execute(makeInput() as any)

    expect(repository.findByReference).toHaveBeenCalledWith('PLUGNOTAS', 'nfse-idem-001')
    expect(repository.create).not.toHaveBeenCalled()
    expect(provider.emitirNfse).not.toHaveBeenCalled()
    expect(output.emissionId).toBe('em-123')
    expect(output.idempotentReplay).toBe(true)
    expect(output.result.externalId).toBe('ext-123')
  })

  it('handles duplicate key race by returning existing emission', async () => {
    const existing = {
      _id: { toString: () => 'em-456' },
      status: NfseEmissionStatus.PENDING,
      provider: 'PLUGNOTAS',
      externalId: 'ext-456',
      providerResponse: { protocol: 'ext-456' },
      providerRequest: { payload: [] },
    }

    const repository = {
      findByReference: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing),
      create: jest.fn().mockRejectedValue({ code: 11000 }),
      updateEmission: jest.fn(),
    }

    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn(),
    }

    const service = new EmitirNfseService(provider as any, repository as any)
    const output = await service.execute(makeInput() as any)

    expect(repository.create).toHaveBeenCalledTimes(1)
    expect(provider.emitirNfse).not.toHaveBeenCalled()
    expect(output.emissionId).toBe('em-456')
    expect(output.idempotentReplay).toBe(true)
    expect(output.result.externalId).toBe('ext-456')
  })

  it('returns idempotentReplay false when emission is newly created', async () => {
    const created = {
      _id: { toString: () => 'em-789' },
    }
    const repository = {
      findByReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      updateEmission: jest.fn().mockResolvedValue(undefined),
    }
    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.PENDING,
        provider: 'PLUGNOTAS',
        externalId: 'ext-789',
      }),
    }

    const service = new EmitirNfseService(provider as any, repository as any)
    const output = await service.execute(makeInput() as any)

    expect(provider.emitirNfse).toHaveBeenCalledTimes(1)
    expect(repository.updateEmission).toHaveBeenCalledTimes(1)
    expect(output.idempotentReplay).toBe(false)
    expect(output.emissionId).toBe('em-789')
  })
})
