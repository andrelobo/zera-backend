import { PollNfseStatusService } from './poll-nfse-status.service'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'

describe('PollNfseStatusService', () => {
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
    }

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
    }

    const service = new PollNfseStatusService(repo as any, provider as any)

    await service.runOnce()

    expect(provider.baixarXmlNfse).toHaveBeenCalledWith('id-nota-999')
    expect(provider.baixarPdfNfse).toHaveBeenCalledWith('id-nota-999')
    expect(repo.updateByExternalId).toHaveBeenCalled()
  })
})
