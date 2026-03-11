import { BadRequestException } from '@nestjs/common';
import { FiscalController } from './fiscal.controller';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';

describe('FiscalController', () => {
  const emitirNfseService = { execute: jest.fn() };
  const emitirNfseQuickService = { execute: jest.fn() };
  const servicoCatalog = {
    autocomplete: jest.fn(),
    list: jest.fn(),
    findByCodigo: jest.fn(),
  };
  const syncNfseArtifactsService = { execute: jest.fn() };
  const repo = {
    findPaginated: jest.fn(),
    getBiSummary: jest.fn(),
    findById: jest.fn(),
    findByExternalId: jest.fn(),
  };
  const provider = {
    getNfseByExternalId: jest.fn(),
    getDocumentById: jest.fn(),
    solicitarCancelamentoNfse: jest.fn(),
    consultarSolicitacaoCancelamentoNfse: jest.fn(),
  };

  let controller: FiscalController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FiscalController(
      emitirNfseService as any,
      emitirNfseQuickService as any,
      servicoCatalog as any,
      syncNfseArtifactsService as any,
      repo as any,
      provider as any,
    );
  });

  it('throws INVALID_PAGE when page is less than 1', async () => {
    await expect(controller.list('0', '20')).rejects.toThrow(BadRequestException);
    await expect(controller.list('0', '20')).rejects.toMatchObject({
      response: { code: 'INVALID_PAGE' },
    });
  });

  it('throws INVALID_LIMIT when limit is less than 1', async () => {
    await expect(controller.list('1', '0')).rejects.toThrow(BadRequestException);
    await expect(controller.list('1', '0')).rejects.toMatchObject({
      response: { code: 'INVALID_LIMIT' },
    });
  });

  it('throws INVALID_STATUS when status is unknown', async () => {
    await expect(controller.list('1', '20', undefined, 'UNKNOWN')).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.list('1', '20', undefined, 'UNKNOWN')).rejects.toMatchObject({
      response: { code: 'INVALID_STATUS' },
    });
  });

  it('forwards filters with defaults and trims provider', async () => {
    repo.findPaginated.mockResolvedValue({
      items: [
        {
          _id: { toString: () => 'em-1' },
          provider: 'PLUGNOTAS',
          status: NfseEmissionStatus.PENDING,
          externalId: 'ext-1',
          empresaCnpj: '43521115000134',
          createdAt: new Date('2026-02-28T00:00:00.000Z'),
          updatedAt: new Date('2026-02-28T00:01:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const out = await controller.list(undefined, undefined, '  plugnotas  ');

    expect(repo.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      provider: 'plugnotas',
      status: undefined,
      createdFrom: undefined,
      createdTo: undefined,
    });
    expect(out).toEqual({
      items: [
        expect.objectContaining({
          id: 'em-1',
          provider: 'PLUGNOTAS',
          status: NfseEmissionStatus.PENDING,
          externalId: 'ext-1',
          empresaCnpj: '43521115000134',
          error: null,
        }),
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    });
  });

  it('accepts valid status filter and forwards enum value', async () => {
    repo.findPaginated.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 1,
    });

    await controller.list('2', '10', undefined, NfseEmissionStatus.AUTHORIZED);

    expect(repo.findPaginated).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      provider: undefined,
      status: NfseEmissionStatus.AUTHORIZED,
      createdFrom: undefined,
      createdTo: undefined,
    });
  });

  it('throws INVALID_DATE_TO when dateTo is invalid', async () => {
    await expect(
      controller.list('1', '20', undefined, undefined, undefined, 'invalid'),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_DATE_TO' },
    });
  });

  it('forwards BI summary filters with sanitization', async () => {
    repo.getBiSummary.mockResolvedValue({
      totals: { totalEmissoes: 0 },
      retencoes: {},
      tributacaoTotal: {},
      seriesCompetencia: [],
      topServicos: [],
      topMunicipiosPrestacao: [],
      topTomadores: [],
    });

    await controller.getBiSummary(
      ' plugnotas ',
      NfseEmissionStatus.AUTHORIZED,
      '43.521.115/0001-34',
      '17.19.01',
      '2026-02-01',
      '2026-03-31',
    );

    expect(repo.getBiSummary).toHaveBeenCalledWith({
      provider: 'plugnotas',
      status: NfseEmissionStatus.AUTHORIZED,
      empresaCnpj: '43521115000134',
      codigoServico: '171901',
      createdFrom: new Date('2026-02-01'),
      createdTo: new Date('2026-03-31'),
    });
  });

  it('emits substituicao using idNota from original emission when body does not provide idNotaSubstituida', async () => {
    repo.findById.mockResolvedValue({
      _id: { toString: () => 'em-1' },
      status: NfseEmissionStatus.AUTHORIZED,
      externalId: 'ext-1',
      providerResponse: { idNota: 'nota-123' },
    });
    emitirNfseService.execute.mockResolvedValue({
      emissionId: 'em-2',
      idempotentReplay: false,
      result: { status: NfseEmissionStatus.PENDING, provider: 'PLUGNOTAS' },
    });

    const payload = {
      referenciaExterna: 'sub-001',
      prestador: {
        cnpj: '43521115000134',
        razaoSocial: 'BURGUS LTDA',
        endereco: {
          logradouro: 'R A',
          numero: '1',
          bairro: 'CENTRO',
          municipio: 'MANAUS',
          uf: 'AM',
          cep: '69010000',
        },
      },
      tomador: {
        cpfCnpj: '11144477735',
        razaoSocial: 'CLIENTE',
        endereco: {
          logradouro: 'R B',
          numero: '2',
          bairro: 'CENTRO',
          municipio: 'MANAUS',
          uf: 'AM',
          cep: '69010000',
        },
      },
      servico: {
        codigoNacional: '171901',
        descricao: 'SERVICO',
        valor: 100,
      },
    };

    await controller.emitirSubstituicao('em-1', payload as any);

    expect(emitirNfseService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        substituicao: true,
        idNotaSubstituida: 'nota-123',
      }),
    );
  });

  it('rejects substituicao when original emission is not AUTHORIZED', async () => {
    repo.findById.mockResolvedValue({
      _id: { toString: () => 'em-1' },
      status: NfseEmissionStatus.PENDING,
      providerResponse: { idNota: 'nota-123' },
    });

    await expect(
      controller.emitirSubstituicao('em-1', {
        referenciaExterna: 'sub-001',
      } as any),
    ).rejects.toMatchObject({
      response: { code: 'SUBSTITUICAO_STATUS_INVALIDO' },
    });
  });
});
