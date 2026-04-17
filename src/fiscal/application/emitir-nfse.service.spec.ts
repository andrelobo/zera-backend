import { EmitirNfseService } from './emitir-nfse.service';
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status';
import { goldenEmitirNfseInput } from '../test-fixtures/emitir-nfse.golden';

describe('EmitirNfseService idempotency', () => {
  function makeEmpresasServiceMock() {
    return {
      getByCnpj: jest.fn().mockResolvedValue({
        cnpj: '43521115000134',
        certificado: { uploadedAt: new Date() },
      }),
      getCadastroResumoByCnpj: jest.fn().mockResolvedValue({
        statusCadastro: 'COMPLETO',
        prontoParaEmitir: true,
        percentualCompletude: 100,
        camposFaltantes: [],
        camposFaltantesEmissao: [],
      }),
    };
  }

  function makeTomadoresServiceMock() {
    return {
      upsertFromEmission: jest.fn().mockResolvedValue(null),
    };
  }

  function makeInput() {
    return structuredClone(goldenEmitirNfseInput);
  }

  it('returns existing emission when idempotency key already exists', async () => {
    const existing = {
      _id: { toString: () => 'em-123' },
      status: NfseEmissionStatus.PENDING,
      provider: 'PLUGNOTAS',
      externalId: 'ext-123',
      providerResponse: { protocol: 'ext-123' },
      providerRequest: { payload: [] },
    };

    const repository = {
      findByReference: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      updateEmission: jest.fn(),
    };

    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn(),
    };

    const empresasService = makeEmpresasServiceMock();
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );
    const output = await service.execute(makeInput() as any);

    expect(repository.findByReference).toHaveBeenCalledWith('PLUGNOTAS', 'nfse-idem-001');
    expect(repository.create).not.toHaveBeenCalled();
    expect(provider.emitirNfse).not.toHaveBeenCalled();
    expect(output.emissionId).toBe('em-123');
    expect(output.idempotentReplay).toBe(true);
    expect(output.result.externalId).toBe('ext-123');
  });

  it('handles duplicate key race by returning existing emission', async () => {
    const existing = {
      _id: { toString: () => 'em-456' },
      status: NfseEmissionStatus.PENDING,
      provider: 'PLUGNOTAS',
      externalId: 'ext-456',
      providerResponse: { protocol: 'ext-456' },
      providerRequest: { payload: [] },
    };

    const repository = {
      findByReference: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
      create: jest.fn().mockRejectedValue({ code: 11000 }),
      updateEmission: jest.fn(),
    };

    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn(),
    };

    const empresasService = makeEmpresasServiceMock();
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );
    const output = await service.execute(makeInput() as any);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(provider.emitirNfse).not.toHaveBeenCalled();
    expect(output.emissionId).toBe('em-456');
    expect(output.idempotentReplay).toBe(true);
    expect(output.result.externalId).toBe('ext-456');
  });

  it('returns idempotentReplay false when emission is newly created', async () => {
    const created = {
      _id: { toString: () => 'em-789' },
    };
    const repository = {
      findByReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      updateEmission: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.PENDING,
        provider: 'PLUGNOTAS',
        externalId: 'ext-789',
      }),
    };

    const empresasService = makeEmpresasServiceMock();
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );
    const output = await service.execute(makeInput() as any);

    expect(provider.emitirNfse).toHaveBeenCalledTimes(1);
    expect(repository.updateEmission).toHaveBeenCalledTimes(1);
    expect(output.idempotentReplay).toBe(false);
    expect(output.emissionId).toBe('em-789');
  });

  it('skips tomador sync when explicitly disabled for quick-origin emissions', async () => {
    const created = { _id: { toString: () => 'em-789-skip' } };
    const repository = {
      findByReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      updateEmission: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.PENDING,
        provider: 'PLUGNOTAS',
        externalId: 'ext-789-skip',
      }),
    };

    const empresasService = makeEmpresasServiceMock();
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );

    const input = { ...makeInput(), syncTomadorCadastro: false };
    await service.execute(input as any);

    expect(tomadoresService.upsertFromEmission).not.toHaveBeenCalled();
    const providerPayload = provider.emitirNfse.mock.calls[0][0];
    expect(providerPayload.syncTomadorCadastro).toBeUndefined();
  });

  it('enriches prestador.regimeTributarioSn in normal flow when missing', async () => {
    const created = { _id: { toString: () => 'em-790' } };
    const repository = {
      findByReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      updateEmission: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.PENDING,
        provider: 'PLUGNOTAS',
        externalId: 'ext-790',
      }),
    };

    const empresasService = {
      getByCnpj: jest.fn().mockResolvedValue({
        cnpj: '43521115000134',
        providerData: { simples: { optante: true } },
      }),
      getCadastroResumoByCnpj: jest.fn().mockResolvedValue({
        statusCadastro: 'COMPLETO',
        prontoParaEmitir: true,
        percentualCompletude: 100,
        camposFaltantes: [],
        camposFaltantesEmissao: [],
      }),
    };
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );

    await service.execute(makeInput() as any);

    expect(provider.emitirNfse).toHaveBeenCalledTimes(1);
    const payload = provider.emitirNfse.mock.calls[0][0];
    expect(payload.prestador.regimeTributarioSn).toEqual({
      opSimpNac: 3,
      regApTribSN: 1,
      regEspTrib: 0,
    });
  });

  it('persists localPrestacao and tributacaoTotal as first-class BI fields', async () => {
    const created = { _id: { toString: () => 'em-791' } };
    const repository = {
      findByReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      updateEmission: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.PENDING,
        provider: 'PLUGNOTAS',
        externalId: 'ext-791',
      }),
    };

    const empresasService = makeEmpresasServiceMock();
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );

    await service.execute(makeInput() as any);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tomadorInscricaoMunicipal: '998877',
        tomadorEmail: 'cliente@example.com',
        tomadorMunicipio: 'Manaus',
        tomadorUf: 'AM',
        servicoCodigoMunicipal: '040101',
        servicoCodigoNacional: '171901',
        localPrestacaoPais: 'Brasil',
        localPrestacaoUf: 'AM',
        localPrestacaoMunicipio: 'Manaus',
        tributacaoTotalFederal: 5,
        tributacaoTotalEstadual: 0,
        tributacaoTotalMunicipal: 2.01,
        biSnapshot: expect.objectContaining({
          localPrestacao: expect.objectContaining({
            pais: 'Brasil',
            uf: 'AM',
            municipio: 'Manaus',
          }),
          metricas: expect.objectContaining({
            tributacaoTotalFederal: 5,
            tributacaoTotalEstadual: 0,
            tributacaoTotalMunicipal: 2.01,
          }),
        }),
      }),
    );
  });

  it('persists parametroIssAplicado only for BI and observability', async () => {
    const created = { _id: { toString: () => 'em-792' } };
    const repository = {
      findByReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      updateEmission: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.PENDING,
        provider: 'PLUGNOTAS',
        externalId: 'ext-792',
      }),
    };

    const empresasService = makeEmpresasServiceMock();
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );

    const input = makeInput() as any;
    input.parametroIssAplicado = 'iss_proprio_municipio';

    await service.execute(input);

    const persisted = repository.create.mock.calls[0][0];
    expect(persisted.parametroIssAplicado).toBe('iss_proprio_municipio');
    expect(persisted.biSnapshot?.parametroIssAplicado).toBe('iss_proprio_municipio');
    expect(persisted.biSnapshot?.metricas?.parametroIssAplicado).toBe('iss_proprio_municipio');

    expect(provider.emitirNfse).toHaveBeenCalledTimes(1);
    expect(provider.emitirNfse.mock.calls[0][0]).not.toHaveProperty('parametroIssAplicado');
  });

  it('persists provider request and rejection body when PlugNotas returns 400', async () => {
    const created = { _id: { toString: () => 'em-793' } };
    const repository = {
      findByReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      updateEmission: jest.fn().mockResolvedValue(undefined),
    };
    const rejectionBody = [{ Codigo: 'E001', Descricao: 'Servico invalido' }];
    const provider = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn().mockRejectedValue({
        status: 400,
        message: 'PlugNotas API error: 400',
        body: rejectionBody,
      }),
    };

    const empresasService = makeEmpresasServiceMock();
    const tomadoresService = makeTomadoresServiceMock();
    const service = new EmitirNfseService(
      provider as any,
      repository as any,
      empresasService as any,
      tomadoresService as any,
    );

    await expect(service.execute(makeInput() as any)).rejects.toMatchObject({
      response: {
        message: 'PLUGNOTAS rejected the request',
        provider: rejectionBody,
      },
    });

    expect(repository.updateEmission).toHaveBeenLastCalledWith(
      'em-793',
      expect.objectContaining({
        status: NfseEmissionStatus.ERROR,
        error: 'PlugNotas API error: 400',
        providerRequest: expect.objectContaining({
          payload: expect.any(Array),
        }),
        providerResponse: rejectionBody,
      }),
    );
  });
});
