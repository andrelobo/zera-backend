import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'
import { SyncNfseArtifactsService } from './sync-nfse-artifacts.service'

describe('SyncNfseArtifactsService', () => {
  beforeEach(() => {
    process.env.NFSE_SYNC_ARTIFACTS_MIN_INTERVAL_MS = '60000'
  })

  it('is idempotent when artifacts already exist', async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        _id: { toString: () => 'em-1' },
        status: NfseEmissionStatus.AUTHORIZED,
        xmlBase64: 'abc',
        pdfBase64: 'def',
      }),
      appendArtifactSyncAudit: jest.fn().mockResolvedValue(undefined),
    }
    const provider = {}
    const service = new SyncNfseArtifactsService(repo as any, provider as any)

    const result = await service.execute({ emissionId: 'em-1' })

    expect(result.synced).toBe(false)
    expect(result.reason).toBe('already_present')
    expect(repo.appendArtifactSyncAudit).toHaveBeenCalled()
  })

  it('rate limits repeated manual sync attempts', async () => {
    const now = Date.now()
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
    }
    const provider = {}
    const service = new SyncNfseArtifactsService(repo as any, provider as any)

    await expect(service.execute({ emissionId: 'em-2' })).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Artifact sync rate limited',
      }),
      status: 429,
    })
    expect(repo.appendArtifactSyncAudit).toHaveBeenCalled()
  })

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
    }
    const provider = {
      consultarNfse: jest.fn().mockResolvedValue({
        status: NfseEmissionStatus.AUTHORIZED,
        providerResponse: { idNota: 'id-nota-3' },
      }),
      baixarXmlNfse: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      baixarPdfNfse: jest.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    }

    const service = new SyncNfseArtifactsService(repo as any, provider as any)
    const result = await service.execute({ emissionId: 'em-3', requestedBy: 'user@test.com' })

    expect(provider.baixarXmlNfse).toHaveBeenCalledWith('id-nota-3')
    expect(provider.baixarPdfNfse).toHaveBeenCalledWith('id-nota-3')
    expect(repo.saveArtifactsById).toHaveBeenCalled()
    expect(result.synced).toBe(true)
    expect(result.reason).toBe('ok')
  })
})
