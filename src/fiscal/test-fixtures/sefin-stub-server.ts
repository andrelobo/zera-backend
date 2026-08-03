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

export function canceledNfseXml(chave: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="${chave}"><cStat>100</cStat><dhProc>2026-08-01T12:00:00+00:00</dhProc><nNFSe>1</nNFSe><nDFSe>1</nDFSe></infNFSe><eventos><evento><e101101><versao>1.01</versao><xJust>Cancelamento a pedido do Prestador</xJust></e101101></evento></eventos></NFSe>`;
}

export interface StubEventoRegistrado {
  cStat: string;
  nProt: string;
  dhRecbto: string;
  tipoEvento: string;
}

/**
 * Servidor HTTPS mTLS local que simula a API SEFIN do Ambiente Nacional:
 * exige certificado de cliente assinado pela CA de teste e expõe
 * POST /nfse, GET /dps/{dpsId}, GET /nfse/{chave} e a API Eventos
 * (POST /nfse/{chave}/eventos e GET /nfse/{chave}/eventos).
 *
 * Cenários por conteúdo da chave de acesso:
 * - `NFS` + 8's  -> NFS-e inexistente (404)
 * - `NFS` + 9's  -> cancelamento não permitido (cStat 600)
 * - `NFS` + 7's  -> NFS-e já cancelada (NFSe com evento e101101)
 * - demais        -> NFS-e autorizada e cancelamento aceito
 */
export class SefinStubServer {
  private server: https.Server | null = null;
  private port = 0;
  private dpsToChave = new Map<string, string>();
  private eventosPorChave = new Map<string, StubEventoRegistrado[]>();

  readonly requests: StubRequestLog[] = [];

  constructor(
    private readonly pki: TestPki,
    private readonly chave: string,
  ) {}

  async start(): Promise<string> {
    this.requests.length = 0;
    this.dpsToChave.clear();
    this.eventosPorChave.clear();

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

  private scenario(chave: string): 'cancelada' | 'inexistente' | 'naoCancelavel' | 'ok' {
    if (/^NFS8+$/.test(chave)) return 'inexistente';
    if (/^NFS9+$/.test(chave)) return 'naoCancelavel';
    if (/^NFS7+$/.test(chave)) return 'cancelada';
    return 'ok';
  }

  private static nProt(chave: string): string {
    const digits = chave.replace(/\D+/g, '');
    return `${'1'.repeat(15 - Math.min(15, digits.length))}${digits.slice(0, 15)}`.slice(-15);
  }

  private static eventoRegistradoXml(chave: string, tipoEvento: string, xJust: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?><retEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><cStat>100</cStat><xMotivo>Evento registrado</xMotivo><nProt>${SefinStubServer.nProt(chave)}</nProt><dhRecbto>2026-08-03T12:00:00+00:00</dhRecbto><${tipoEvento}><versao>1.01</versao><xJust>${xJust}</xJust></${tipoEvento}></retEvento>`;
  }

  private static eventosConsultaXml(eventos: StubEventoRegistrado[]): string {
    const items = eventos
      .map(
        (evento) =>
          `<evento><cStat>${evento.cStat}</cStat><xMotivo>Cancelamento registrado</xMotivo><nProt>${evento.nProt}</nProt><dhRecbto>${evento.dhRecbto}</dhRecbto><${evento.tipoEvento}><versao>1.01</versao><xJust>Cancelamento a pedido do Prestador</xJust></${evento.tipoEvento}></evento>`,
      )
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><consultarEventos xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><cStat>100</cStat><xMotivo>Sucesso</xMotivo><eventos>${items}</eventos></consultarEventos>`;
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

    if (req.method === 'POST' && pathname.startsWith('/nfse/') && pathname.endsWith('/eventos')) {
      const chave = pathname.replace('/nfse/', '').replace('/eventos', '');
      const scenario = this.scenario(chave);
      if (scenario === 'inexistente') {
        this.send(res, 404, JSON.stringify({ code: 'NFSE_NOT_FOUND' }), 'application/json');
        return;
      }
      if (scenario === 'naoCancelavel') {
        const reject =
          `<retEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
          `<cStat>600</cStat><xMotivo>Cancelamento não permitido para esta NFS-e</xMotivo>` +
          `</retEvento>`;
        this.send(res, 400, reject, 'application/xml');
        return;
      }
      const tipoEvento = /e\d{6}/.exec(body)?.[0] ?? 'e101101';
      const registro: StubEventoRegistrado = {
        cStat: '100',
        nProt: SefinStubServer.nProt(chave),
        dhRecbto: '2026-08-03T12:00:00+00:00',
        tipoEvento,
      };
      const registrados = this.eventosPorChave.get(chave) ?? [];
      registrados.push(registro);
      this.eventosPorChave.set(chave, registrados);
      this.send(
        res,
        200,
        SefinStubServer.eventoRegistradoXml(
          chave,
          tipoEvento,
          'Cancelamento a pedido do Prestador',
        ),
        'application/xml',
      );
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/nfse/') && pathname.endsWith('/eventos')) {
      const chave = pathname.replace('/nfse/', '').replace('/eventos', '');
      const scenario = this.scenario(chave);
      if (scenario === 'inexistente') {
        this.send(res, 404, JSON.stringify({ code: 'NFSE_NOT_FOUND' }), 'application/json');
        return;
      }
      const registrados = this.eventosPorChave.get(chave) ?? [];
      if (scenario === 'cancelada' && registrados.length === 0) {
        registrados.push({
          cStat: '100',
          nProt: SefinStubServer.nProt(chave),
          dhRecbto: '2026-08-02T12:00:00+00:00',
          tipoEvento: 'e101101',
        });
      }
      this.send(res, 200, SefinStubServer.eventosConsultaXml(registrados), 'application/xml');
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/nfse/')) {
      const chave = pathname.replace('/nfse/', '');
      const scenario = this.scenario(chave);
      if (scenario === 'inexistente') {
        this.send(res, 404, JSON.stringify({ code: 'NFSE_NOT_FOUND' }), 'application/json');
        return;
      }
      if (scenario === 'naoCancelavel') {
        this.send(
          res,
          200,
          `<resNfse xmlns="http://www.sped.fazenda.gov.br/nfse"><cStat>600</cStat><xMotivo>Cancelamento não permitido para esta NFS-e</xMotivo></resNfse>`,
          'application/xml',
        );
        return;
      }
      if (scenario === 'cancelada') {
        this.send(res, 200, canceledNfseXml(chave), 'application/xml');
        return;
      }
      this.send(res, 200, authorizedNfseXml(chave), 'application/xml');
      return;
    }

    this.send(res, 404, JSON.stringify({ code: 'NOT_FOUND' }), 'application/json');
  }
}
