import * as http from 'node:http';
import * as https from 'node:https';
import type { TLSSocket } from 'node:tls';

import type { TestPki } from './test-cert';
import { extractDpsId } from '../infra/sefin/dps-signer';

export interface StubRequestLog {
  method: string;
  path: string;
  body: string;
  clientCertCn?: string;
}

export function authorizedNfseXml(chave: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="${chave}"><cStat>100</cStat><dhProc>2026-08-01T12:00:00+00:00</dhProc><nNFSe>1</nNFSe><nDFSe>1</nDFSe></infNFSe></NFSe>`;
}

/**
 * Servidor HTTPS mTLS local que simula a API SEFIN do Ambiente Nacional:
 * exige certificado de cliente assinado pela CA de teste e expõe
 * POST /nfse, GET /dps/{dpsId} e GET /nfse/{chave}.
 */
export class SefinStubServer {
  private server: https.Server | null = null;
  private port = 0;
  private dpsToChave = new Map<string, string>();

  readonly requests: StubRequestLog[] = [];

  constructor(
    private readonly pki: TestPki,
    private readonly chave: string,
  ) {}

  async start(): Promise<string> {
    this.requests.length = 0;
    this.dpsToChave.clear();

    this.server = https.createServer({
      key: this.pki.serverKeyPem,
      cert: this.pki.serverCertPem,
      ca: this.pki.caPem,
      requestCert: true,
      rejectUnauthorized: true,
    });

    this.server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
      void this.handle(req, res);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, '127.0.0.1', () => {
        this.port = (this.server!.address() as { port: number }).port;
        resolve();
      });
    });

    return `https://127.0.0.1:${this.port}`;
  }

  async close(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private send(res: http.ServerResponse, status: number, body: string, contentType: string): void {
    res.writeHead(status, {
      'Content-Type': contentType,
      Connection: 'close',
    });
    res.end(body);
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    const socket = req.socket as TLSSocket;
    const peerCert = socket.getPeerCertificate();
    const clientCertCn =
      (peerCert?.subject as { CN?: string } | undefined)?.CN ??
      (peerCert as { subject?: { CN?: string } } | undefined)?.subject?.CN;

    const { pathname } = new URL(req.url ?? '/', 'https://localhost');
    this.requests.push({ method: req.method ?? '', path: pathname, body, clientCertCn });

    if (req.method === 'POST' && pathname === '/nfse') {
      const dpsId = extractDpsId(body);
      this.dpsToChave.set(dpsId, this.chave);
      this.send(res, 200, authorizedNfseXml(this.chave), 'application/xml');
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/dps/')) {
      const dpsId = pathname.replace('/dps/', '');
      const chave = this.dpsToChave.get(dpsId);
      if (!chave) {
        this.send(res, 404, JSON.stringify({ dpsId, gerada: false }), 'application/json');
        return;
      }
      this.send(
        res,
        200,
        JSON.stringify({ dpsId, chaveAcesso: chave, gerada: true }),
        'application/json',
      );
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/nfse/')) {
      const chave = pathname.replace('/nfse/', '');
      this.send(res, 200, authorizedNfseXml(chave), 'application/xml');
      return;
    }

    this.send(res, 404, JSON.stringify({ code: 'NOT_FOUND' }), 'application/json');
  }
}
