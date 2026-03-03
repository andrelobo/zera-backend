import { PlugNotasNfseApi } from './nfse.api';

describe('PlugNotasNfseApi', () => {
  const originalCancelPath = process.env.PLUGNOTAS_NFSE_CANCEL_PATH;
  const originalCancelStatusPath = process.env.PLUGNOTAS_NFSE_CANCEL_STATUS_PATH;
  const originalApiKey = process.env.PLUGNOTAS_API_KEY;

  beforeEach(() => {
    process.env.PLUGNOTAS_API_KEY = 'test-key';
    delete process.env.PLUGNOTAS_NFSE_CANCEL_PATH;
    delete process.env.PLUGNOTAS_NFSE_CANCEL_STATUS_PATH;
  });

  afterEach(() => {
    process.env.PLUGNOTAS_NFSE_CANCEL_PATH = originalCancelPath;
    process.env.PLUGNOTAS_NFSE_CANCEL_STATUS_PATH = originalCancelStatusPath;
    process.env.PLUGNOTAS_API_KEY = originalApiKey;
  });

  it('uses POST /nfse/cancelar/{idNota} as default cancel path', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true });
    const api = new PlugNotasNfseApi({ request } as any);

    await api.solicitarCancelamentoNfse('id-nota-1', { codigo: '9', motivo: 'teste' });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/nfse/cancelar/id-nota-1',
        body: { codigo: '9', motivo: 'teste' },
      }),
    );
  });

  it('uses POST /nfse/cancelar/status/{cancellationProtocol} for cancellation status', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true });
    const api = new PlugNotasNfseApi({ request } as any);

    await api.consultarSolicitacaoCancelamentoNfse('prot-1');

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/nfse/cancelar/status/prot-1',
      }),
    );
  });
});
