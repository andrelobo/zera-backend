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
    findById: jest.fn(),
    findByExternalId: jest.fn(),
  };
  const provider = {
    getNfseByExternalId: jest.fn(),
    getDocumentById: jest.fn(),
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
    });
  });
});
