import { NfseEmissionStatus } from '../../../domain/types/nfse-emission-status';
import { buildExternalReferenceFilter, NfseEmissionRepository } from './nfse-emission.repository';

describe('NfseEmissionRepository', () => {
  it('builds an external reference filter with provider response fallbacks', () => {
    expect(buildExternalReferenceFilter('ext-123')).toEqual({
      $or: expect.arrayContaining([
        { externalId: 'ext-123' },
        { idempotencyKey: 'ext-123' },
        { 'payload.referenciaExterna': 'ext-123' },
        { 'providerResponse.id': 'ext-123' },
        { 'providerResponse.protocol': 'ext-123' },
        { 'providerResponse.documents.id': 'ext-123' },
        { 'providerResponse.documents.protocol': 'ext-123' },
      ]),
    });
  });

  it('finds emissions by any equivalent external reference', async () => {
    const exec = jest.fn().mockResolvedValue({ _id: 'emission-1' });
    const sort = jest.fn().mockReturnValue({ exec });
    const findOne = jest.fn().mockReturnValue({ sort });
    const repo = new NfseEmissionRepository({ findOne } as any);

    const doc = await repo.findByExternalId('protocol-123');

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { externalId: 'protocol-123' },
          { 'providerResponse.protocol': 'protocol-123' },
          { 'providerResponse.documents.protocol': 'protocol-123' },
        ]),
      }),
    );
    expect(doc).toEqual({ _id: 'emission-1' });
  });

  it('updates emissions by matching any equivalent external reference', async () => {
    const updateMany = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const repo = new NfseEmissionRepository({ updateMany } as any);

    const result = await repo.updateByExternalId({
      externalId: 'note-id-123',
      resolvedExternalId: 'protocol-123',
      status: NfseEmissionStatus.AUTHORIZED,
      provider: 'PLUGNOTAS',
      providerResponse: {
        id: 'note-id-123',
        dps: { numero: 41, serie: '01' },
        retorno: { numeroNfse: '28' },
      },
      lastWebhookAt: new Date('2026-03-25T17:53:21.000Z'),
      lastUpdateSource: 'webhook',
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.arrayContaining([
              { externalId: 'note-id-123' },
              { 'providerResponse.id': 'note-id-123' },
              { 'providerResponse.documents.id': 'note-id-123' },
            ]),
          }),
          {
            $or: [
              { status: NfseEmissionStatus.PENDING },
              { status: NfseEmissionStatus.AUTHORIZED },
            ],
          },
          { provider: 'PLUGNOTAS' },
        ]),
      }),
      expect.objectContaining({
        externalId: 'protocol-123',
        status: NfseEmissionStatus.AUTHORIZED,
        numeroNfse: '28',
        dpsNum: '41',
        serieDpsNum: '01',
        nextPollAt: null,
        lastPollError: null,
        lastUpdateSource: 'webhook',
      }),
    );
    expect(result).toEqual({ matchedCount: 1, modifiedCount: 1 });
  });
});
