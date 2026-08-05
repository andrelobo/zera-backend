import { NfseEmissionStatus } from '../domain/types/nfse-emission-status';
import { SyncNfseArtifactsService } from './sync-nfse-artifacts.service';

describe('SyncNfseArtifactsService', () => {
  beforeEach(() => {
    process.env.NFSE_SYNC_ARTIFACTS_MIN_INTERVAL_MS = '60000';
  });

  it('bloqueia sincronizacao de notas historicas PlugNotas (PLUGNOTAS_DISABLED)', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        _id: { toString: () => 'em-plug' },
        status: NfseEmissionStatus.AUTHORIZED,
        provider: 'PLUGNOTAS',
        externalId: 'ext-plug',
        xmlBase64: null,
        pdfBase64: null,
        lastArtifactSyncAt: null,
      }),
      appendArtifactSyncAudit: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      consultarNfse: jest.fn().mockResolvedValue({}),
      baixarXmlNfse: jest.fn(),
      baixarPdfNfse: jest.fn(),
    };
    const service = new SyncNfseArtifactsService(repo as any, provider as any);

    await expect(service.execute({ emissionId: 'em-plug', force: true })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLUGNOTAS_DISABLED' }),
    });
    expect(provider.consultarNfse).not.toHaveBeenCalled();
    expect(provider.baixarXmlNfse).not.toHaveBeenCalled();
    expect(provider.baixarPdfNfse).not.toHaveBeenCalled();
    expect(repo.appendArtifactSyncAudit).toHaveBeenCalledWith(
      'em-plug',
      expect.objectContaining({ outcome: 'blocked_plugnotas_disabled' }),
    );
  });

  it('is idempotent when artifacts already exist', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        _id: { toString: () => 'em-1' },
        status: NfseEmissionStatus.AUTHORIZED,
        xmlBase64: 'abc',
        pdfBase64: 'def',
      }),
      appendArtifactSyncAudit: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {};
    const service = new SyncNfseArtifactsService(repo as any, provider as any);

    const result = await service.execute({ emissionId: 'em-1' });

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('already_present');
    expect(repo.appendArtifactSyncAudit).toHaveBeenCalled();
  });

  it('regenerates artifacts when force=true even if already present', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        _id: { toString: () => 'em-4' },
        status: NfseEmissionStatus.AUTHORIZED,
        externalId: 'ext-4',
        xmlBase64: 'abc',
        pdfBase64: 'def',
        lastArtifactSyncAt: null,
      }),
      saveArtifactsById: jest.fn().mockResolvedValue(undefined),
      appendArtifactSyncAudit: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      consultarNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.AUTHORIZED,
        providerResponse: { idNota: 'id-nota-4' },
      }),
      baixarXmlNfse: jest.fn().mockResolvedValue(new Uint8Array([1, 1])),
      baixarPdfNfse: jest.fn().mockResolvedValue(new Uint8Array([2, 2])),
    };

    const service = new SyncNfseArtifactsService(repo as any, provider as any);
    const result = await service.execute({ emissionId: 'em-4', force: true });

    expect(result.synced).toBe(true);
    expect(result.reason).toBe('ok');
    expect(provider.consultarNfse).toHaveBeenCalled();
    expect(repo.saveArtifactsById).toHaveBeenCalledWith(
      expect.objectContaining({ xmlBase64: 'AQE=', pdfBase64: 'AgI=' }),
    );
  });

  it('rate limits repeated manual sync attempts', async () => {
    const now = Date.now();
    const repo = {
      findById: jest.fn().mockResolvedValue({
        _id: { toString: () => 'em-2' },
        status: NfseEmissionStatus.ERROR,
        externalId: 'ext-2',
        xmlBase64: null,
        pdfBase64: null,
        lastArtifactSyncAt: new Date(now - 1000),
      }),
      appendArtifactSyncAudit: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {};
    const service = new SyncNfseArtifactsService(repo as any, provider as any);

    await expect(service.execute({ emissionId: 'em-2' })).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Artifact sync rate limited',
      }),
      status: 429,
    });
    expect(repo.appendArtifactSyncAudit).toHaveBeenCalled();
  });

  it('downloads and persists artifacts when provider is authorized', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        _id: { toString: () => 'em-3' },
        status: NfseEmissionStatus.ERROR,
        externalId: 'protocol-3',
        xmlBase64: null,
        pdfBase64: null,
        lastArtifactSyncAt: null,
      }),
      saveArtifactsById: jest.fn().mockResolvedValue(undefined),
      appendArtifactSyncAudit: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      consultarNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.AUTHORIZED,
        providerResponse: { idNota: 'id-nota-3' },
      }),
      baixarXmlNfse: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      baixarPdfNfse: jest.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    };

    const service = new SyncNfseArtifactsService(repo as any, provider as any);
    const result = await service.execute({ emissionId: 'em-3', requestedBy: 'user@test.com' });

    expect(provider.baixarXmlNfse).toHaveBeenCalledWith('id-nota-3');
    expect(provider.baixarPdfNfse).toHaveBeenCalledWith('id-nota-3');
    expect(repo.saveArtifactsById).toHaveBeenCalledWith({
      id: 'em-3',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: { idNota: 'id-nota-3' },
      xmlBase64: 'AQID',
      pdfBase64: 'BAUG',
      error: null,
    });
    expect(result.synced).toBe(true);
    expect(result.reason).toBe('ok');
  });
});
