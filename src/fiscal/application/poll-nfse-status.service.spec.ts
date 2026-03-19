import { PollNfseStatusService } from './poll-nfse-status.service';
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status';
import { Logger } from '@nestjs/common';

describe('PollNfseStatusService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads XML/PDF using idNota from provider response when authorized', async () => {
    const repo = {
      findPending: jest.fn().mockResolvedValue([
        {
          externalId: 'protocol-123',
          pollAttempts: 0,
        },
      ]),
      updateByExternalId: jest.fn().mockResolvedValue(undefined),
      markPollingTransientFailure: jest.fn().mockResolvedValue(undefined),
    };

    const provider = {
      providerName: 'PLUGNOTAS',
      consultarNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.AUTHORIZED,
        providerResponse: {
          idNota: 'id-nota-999',
          status: 'AUTORIZADA',
        },
      }),
      baixarXmlNfse: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      baixarPdfNfse: jest.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    };

    const service = new PollNfseStatusService(repo as any, provider as any);

    await service.runOnce();

    expect(provider.baixarXmlNfse).toHaveBeenCalledWith('id-nota-999');
    expect(provider.baixarPdfNfse).toHaveBeenCalledWith('id-nota-999');
    expect(repo.updateByExternalId).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'protocol-123',
        status: NfseEmissionStatus.AUTHORIZED,
        lastPolledAt: expect.any(Date),
        lastUpdateSource: 'polling',
      }),
    );
  });

  it('marks fatal polling errors with polling as the update source', async () => {
    const repo = {
      findPending: jest.fn().mockResolvedValue([
        {
          externalId: 'protocol-err-1',
          pollAttempts: 0,
        },
      ]),
      updateByExternalId: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
      markPollingTransientFailure: jest.fn().mockResolvedValue(undefined),
    };

    const provider = {
      providerName: 'PLUGNOTAS',
      consultarNfse: jest.fn().mockRejectedValue({
        status: 400,
        message: 'bad request',
      }),
    };

    const service = new PollNfseStatusService(repo as any, provider as any);

    await service.runOnce();

    expect(repo.updateByExternalId).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'protocol-err-1',
        status: NfseEmissionStatus.ERROR,
        error: 'bad request',
        lastPolledAt: expect.any(Date),
        lastUpdateSource: 'polling',
      }),
    );
    expect(repo.markPollingTransientFailure).not.toHaveBeenCalled();
  });

  it('logs when polling cannot update an emission because it is no longer eligible', async () => {
    const repo = {
      findPending: jest.fn().mockResolvedValue([
        {
          externalId: 'protocol-no-match-1',
          pollAttempts: 0,
        },
      ]),
      updateByExternalId: jest.fn().mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }),
      markPollingTransientFailure: jest.fn().mockResolvedValue(undefined),
    };

    const provider = {
      providerName: 'PLUGNOTAS',
      consultarNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.PENDING,
        providerResponse: { status: 'PROCESSANDO' },
      }),
    };

    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new PollNfseStatusService(repo as any, provider as any);

    await service.runOnce();

    expect(repo.updateByExternalId).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'protocol-no-match-1',
        status: NfseEmissionStatus.PENDING,
        lastUpdateSource: 'polling',
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Polling skipped externalId=protocol-no-match-1: emission not found or not eligible',
    );
  });
});
