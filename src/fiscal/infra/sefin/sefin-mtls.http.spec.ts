import { request as httpsRequest } from 'node:https';

import { SefinMtlsHttp } from './sefin-mtls.http';

jest.mock('node:https', () => {
  const { EventEmitter } = jest.requireActual('node:events');
  const request = jest.fn();
  const state: any = {
    status: 200,
    headers: {},
    body: Buffer.from(''),
    autoRespond: true,
    calls: [],
    req: null,
  };
  request.mockImplementation((url: string, options: any, cb: any) => {
    state.calls.push({ url, options, cb });
    const req: any = new EventEmitter();
    req.write = jest.fn();
    req.end = jest.fn(() => {
      if (!state.autoRespond) return;
      const res = {
        statusCode: state.status,
        headers: state.headers,
        on: (event: string, handler: any) => {
          if (event === 'data') handler(state.body);
          if (event === 'end') handler();
        },
      };
      cb(res);
      req.emit('close');
    });
    req.destroy = (err?: any) => {
      if (err) req.emit('error', err);
      req.emit('close');
    };
    state.req = req;
    return req;
  });
  (request as any).__state = state;
  return { request };
});

const mockState = () => (httpsRequest as any).__state;

const cert = {
  privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----',
  certificatePem: '-----BEGIN CERTIFICATE-----',
};
const CHAVE = `NFS${'1'.repeat(50)}`;

describe('SefinMtlsHttp', () => {
  beforeEach(() => {
    mockState().status = 200;
    mockState().headers = {};
    mockState().body = Buffer.from('');
    mockState().autoRespond = true;
    mockState().calls.length = 0;
    mockState().req = null;
    delete process.env.SEFIN_HTTP_TIMEOUT_MS;
  });

  it('envia mTLS (key/cert/rejectUnauthorized) e parseia JSON', async () => {
    mockState().headers = { 'content-type': 'application/json' };
    mockState().body = Buffer.from(JSON.stringify({ chaveAcesso: CHAVE }));

    const http = new SefinMtlsHttp();
    const res = await http.request({ method: 'GET', path: `/dps/${'DPS'.padEnd(45, '2')}`, cert });

    expect(res.json.chaveAcesso).toBe(CHAVE);
    const call = mockState().calls[0];
    expect(call.url).toContain('/dps/');
    expect(call.options.key).toBe(cert.privateKeyPem);
    expect(call.options.cert).toBe(cert.certificatePem);
    expect(call.options.rejectUnauthorized).toBe(true);
    expect(call.options.headers.Accept).toContain('application/xml');
  });

  it('envia body e content-type em POST', async () => {
    mockState().headers = { 'content-type': 'application/xml' };
    mockState().body = Buffer.from('<NFSe/>');

    const http = new SefinMtlsHttp();
    await http.request({
      method: 'POST',
      path: '/nfse',
      cert,
      body: '<DPS/>',
      contentType: 'application/xml',
    });

    const call = mockState().calls[0];
    expect(call.options.method).toBe('POST');
    expect(call.options.headers['Content-Type']).toBe('application/xml');
  });

  it('erro HTTP 5xx vira SEFIN_HTTP_ERROR com corpo JSON preservado', async () => {
    mockState().status = 500;
    mockState().headers = { 'content-type': 'application/json' };
    mockState().body = Buffer.from(JSON.stringify({ cStat: 501, xMotivo: 'falha interna' }));

    const http = new SefinMtlsHttp();
    await expect(http.request({ method: 'GET', path: '/nfse', cert })).rejects.toMatchObject({
      code: 'SEFIN_HTTP_ERROR',
      status: 500,
      body: { cStat: 501 },
    });
  });

  it('mapeia retry-after para retryAfterMs', async () => {
    mockState().status = 429;
    mockState().headers = { 'retry-after': '2', 'content-type': 'text/plain' };
    mockState().body = Buffer.from('');

    const http = new SefinMtlsHttp();
    await expect(http.request({ method: 'GET', path: '/nfse', cert })).rejects.toMatchObject({
      code: 'SEFIN_HTTP_ERROR',
      status: 429,
      retryAfterMs: 2000,
    });
  });

  it('erro de verificação de certificado vira SEFIN_CERT_VERIFY_FAILED', async () => {
    mockState().autoRespond = false;

    const http = new SefinMtlsHttp();
    const promise = http.request({ method: 'GET', path: '/nfse', cert });
    const err: any = new Error('unable to verify leaf signature');
    err.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
    mockState().req.destroy(err);

    await expect(promise).rejects.toMatchObject({ code: 'SEFIN_CERT_VERIFY_FAILED' });
  });

  it('timeout sem resposta vira SEFIN_REQUEST_TIMEOUT', async () => {
    process.env.SEFIN_HTTP_TIMEOUT_MS = '20';
    mockState().autoRespond = false;

    const http = new SefinMtlsHttp();
    await expect(http.request({ method: 'GET', path: '/nfse', cert })).rejects.toMatchObject({
      code: 'SEFIN_REQUEST_TIMEOUT',
    });
  });
});
