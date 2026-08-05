import { PlugNotasHttp } from './plugnotas.http';

describe('PlugNotasHttp (kill switch permanente)', () => {
  it('request lanca PLUGNOTAS_DISABLED sem realizar nenhuma chamada externa', async () => {
    const http = new PlugNotasHttp();
    await expect(
      http.request({ method: 'GET', path: '/nfse', query: { id: 'x' } }),
    ).rejects.toMatchObject({ code: 'PLUGNOTAS_DISABLED', status: 409 });
  });

  it('bloqueia tambem operacoes POST (emissao/sincronizacao/cancelamento)', async () => {
    const http = new PlugNotasHttp();
    await expect(
      http.request({ method: 'POST', path: '/nfse', body: { documento: [] } }),
    ).rejects.toMatchObject({ code: 'PLUGNOTAS_DISABLED' });
  });
});
