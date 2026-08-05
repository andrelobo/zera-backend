import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { extractElementId, extractTag, hasElement } from './sefin-xml';

/**
 * Gerador do DANFSe (Documento Auxiliar da NFS-e) v2.0.
 *
 * Conforme Nota Técnica nº 008 SE/CGNFS-e v1.02 (14/07/2026) — doc 06 §2.5.
 * A API oficial de geração (`adn.nfse.gov.br/danfse`) foi suspensa em 03/08/2026,
 * tornando obrigatória a geração própria pelos sistemas de emissão.
 *
 * A especificação define que os campos devem representar exclusivamente o conteúdo
 * das tags XML da NFS-e emitida (campos sem dado no XML são impressos com "-"),
 * que os tamanhos da seção 2.4.5 são sugestões (não obrigatórios) e que a
 * disposição deve seguir o modelo do Anexo I. Este gerador reproduz o modelo em
 * A4 (retrato), com fontes Helvetica (metricamente equivalentes a Arial).
 */

const CM = 28.346456693; // pontos por cm
const PAGE_W = 21 * CM;
const PAGE_H = 29.7 * CM;
const LEFT = 0.3 * CM;
const BODY_W = 20.4 * CM;
const RIGHT = LEFT + BODY_W;

const BLACK = rgb(0, 0, 0);
const SHADING = rgb(0.95, 0.95, 0.95);
const WATERMARK = rgb(0.65, 0.65, 0.65);
const RED = rgb(1, 0, 0);

const LABEL_SIZE = 6;
const CONTENT_SIZE = 7;
const BLOCK_TITLE_SIZE = 7;
const HEADER_TITLE_SIZE = 9;

const NFSE_CHAVE_PATTERN = /^NFS[0-9]{50}$/;

export type DanfseSituacao = 'CANCELADA' | 'SUBSTITUIDA';

export interface DanfsePessoa {
  documento?: string;
  im?: string;
  fone?: string;
  xNome?: string;
  endereco?: string;
  municipioUf?: string;
  cMun?: string;
  uf?: string;
  cep?: string;
  email?: string;
}

export interface DanfseData {
  chaveAcesso: string;
  nNFSe?: string;
  dCompet?: string;
  dhProc?: string;
  nDPS?: string;
  serie?: string;
  dhEmi?: string;
  tpEmit?: string;
  cStat?: string;
  finNFSe?: string;
  xLocEmi?: string;
  ambGer?: string;
  tpAmb?: '1' | '2';
  prest: DanfsePessoa;
  prestSn?: { opSimpNac?: string; regApTribSN?: string; regEspTrib?: string };
  toma?: DanfsePessoa;
  dest?: DanfsePessoa;
  interm?: DanfsePessoa;
  serv: {
    cTribNac?: string;
    cTribMun?: string;
    cNBS?: string;
    xLocPrestacao?: string;
    xTribNac?: string;
    xTribMun?: string;
    xDescServ?: string;
  };
  iss?: {
    tribISSQN?: string;
    xLocIncid?: string;
    regEspTrib?: string;
    tpImunidade?: string;
    tpSusp?: string;
    nProcesso?: string;
    tpBM?: string;
    vCalcBM?: string;
    vDedRed?: string;
    vDescIncond?: string;
    vBC?: string;
    pAliq?: string;
    tpRetISSQN?: string;
    vISSQN?: string;
  };
  fed?: {
    vRetIRRF?: string;
    vRetCP?: string;
    vRetCSLL?: string;
    vPis?: string;
    vCofins?: string;
    tpRetPisCofins?: string;
  };
  ibscbs?: {
    cst?: string;
    cClassTrib?: string;
    cIndOp?: string;
    xLocalidadeIncid?: string;
    vExclusoes?: string;
    vBC?: string;
    pRedAliq?: string;
    pAliq?: string;
    pAliqEfetMun?: string;
    vIBSMun?: string;
    pAliqEfetUF?: string;
    vIBSUF?: string;
    vIBSTot?: string;
    pCBS?: string;
    pAliqEfetCBS?: string;
    vCBS?: string;
  };
  totais: {
    vServ?: string;
    vDescIncond?: string;
    vDescCond?: string;
    vTotalRet?: string;
    vLiq?: string;
    vIBSCBS?: string;
    vTotNF?: string;
  };
  totTrib?: { fed?: string; est?: string; mun?: string };
  infoCompl?: string;
  situacao?: DanfseSituacao;
}

const TP_EMIT: Record<string, string> = {
  '1': 'Prestador',
  '2': 'Tomador',
  '3': 'Intermediário',
};

const TP_AMB: Record<string, string> = {
  '1': 'Produção',
  '2': 'Homologação',
};

const TP_RET_ISSQN: Record<string, string> = {
  '1': 'Não Retido',
  '2': 'Retido',
};

const OP_SIMP_NAC: Record<string, string> = {
  '1': 'Sim',
  '2': 'Sim, com isenção na competência',
  '3': 'Não Optante',
};

const REG_AP_TRIB_SN: Record<string, string> = {
  '1': 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
  '2': 'Regime de apuração dos tributos federais pelo Simples Nacional e municipal pelo regime normal',
  '3': 'Regime de apuração dos tributos federais pelo regime normal e municipal pelo Simples Nacional',
  '4': 'Regime de apuração dos tributos federais e municipal pelo regime normal',
};

const REG_ESP_TRIB: Record<string, string> = {
  '0': 'Não possui regime especial de tributação',
  '1': 'Estimativa',
  '2': 'Sociedade de profissionais',
  '3': 'Cooperativa',
  '4': 'Microempresário individual',
  '5': 'Microempresa e empresa de pequeno porte',
  '6': 'Comércio de bebidas',
  '9': 'Outro regime especial',
};

const TRIB_ISSQN: Record<string, string> = {
  '1': 'Operação tributável',
  '2': 'Operação não tributável',
  '3': 'Operação com redução de base de cálculo',
  '4': 'Operação imune',
};

const FIN_NFSE: Record<string, string> = {
  '1': 'NFS-e regular',
  '2': 'NFS-e de Decisão Judicial ou Administrativa',
  '3': 'NFS-e de convênio',
};

function unescapeXml(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function onlyDigits(value: string | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

function desc(table: Record<string, string>, code: string | undefined): string | undefined {
  if (code === undefined || code === '') return undefined;
  return table[code] ?? code;
}

function maskDocumento(value: string | undefined): string | undefined {
  const digits = onlyDigits(value);
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return value || undefined;
}

function maskCep(value: string | undefined): string | undefined {
  const digits = onlyDigits(value);
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return value || undefined;
}

function dataBr(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length !== 8) return value;
  return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
}

function dataHoraBr(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return dataBr(value);
  return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}:${match[6]}`;
}

function fmtMoney(value: string | undefined): string {
  if (value === undefined || value === '' || !Number.isFinite(Number(value))) return '-';
  const n = Number(value);
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

function fmtPct(value: string | undefined): string {
  if (value === undefined || value === '' || !Number.isFinite(Number(value))) return '-';
  const n = Number(value);
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}%`;
}

function parsePessoa(sub: string | undefined): DanfsePessoa | undefined {
  if (!sub || !sub.trim()) return undefined;
  const endNac = extractTag(sub, 'endNac') ?? extractTag(sub, 'enderNac');
  const endExt = extractTag(sub, 'endExt');
  const end = endNac ?? endExt ?? '';
  const endereco = [
    extractTag(end, 'xLgr'),
    extractTag(end, 'nro'),
    extractTag(end, 'xCpl'),
    extractTag(end, 'xBairro'),
  ]
    .filter((v) => v !== undefined)
    .join(', ')
    .trim();
  const municipioUf = [extractTag(end, 'xMun'), extractTag(end, 'UF')]
    .filter((v) => v !== undefined)
    .join(' / ')
    .trim();
  return {
    documento: maskDocumento(
      extractTag(sub, 'CNPJ') ?? extractTag(sub, 'CPF') ?? extractTag(sub, 'NIF'),
    ),
    im: extractTag(sub, 'IM'),
    fone: extractTag(sub, 'fone'),
    xNome: unescapeXml(extractTag(sub, 'xNome')),
    endereco: endereco || undefined,
    municipioUf: municipioUf || undefined,
    cMun: extractTag(end, 'cMun'),
    uf: extractTag(end, 'UF'),
    cep: maskCep(extractTag(end, 'CEP') ?? extractTag(end, 'cEndPost')),
    email: extractTag(sub, 'email'),
  };
}

function mergePessoa(...pess: (DanfsePessoa | undefined)[]): DanfsePessoa {
  const out: DanfsePessoa = {};
  for (const p of pess) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export function detectDanfseSituacao(xml: string): DanfseSituacao | undefined {
  if (hasElement(xml, 'e105102')) return 'SUBSTITUIDA';
  if (hasElement(xml, 'e101101')) return 'CANCELADA';
  return undefined;
}

/**
 * Extrai do XML da NFS-e (NFSe/infNFSe [+ DPS/infDPS]) os dados necessários
 * ao DANFSe v2.0, conforme os caminhos de tag da seção 2.4.5 da NT 008.
 */
export function parseNfseToDanfse(xml: string): DanfseData {
  const nfse = extractTag(xml, 'infNFSe') ?? xml;
  const dps = extractTag(nfse, 'infDPS') ?? '';

  const chaveAcesso = (extractElementId(xml, 'infNFSe', NFSE_CHAVE_PATTERN) ?? '').replace(
    /^NFS/,
    '',
  );

  const prest = mergePessoa(
    parsePessoa(extractTag(nfse, 'emit')),
    parsePessoa(extractTag(dps, 'prest')),
  );
  if (prest.municipioUf === prest.uf && prest.uf !== undefined) {
    const xLoc =
      extractTag(nfse, 'xLocIncid') ??
      extractTag(nfse, 'xLocEmi') ??
      extractTag(nfse, 'xLocPrestacao');
    if (xLoc) prest.municipioUf = `${xLoc} / ${prest.uf}`;
  }

  const regTrib = extractTag(dps, 'regTrib');
  const prestSn = {
    opSimpNac: desc(OP_SIMP_NAC, extractTag(regTrib ?? '', 'opSimpNac')),
    regApTribSN: desc(REG_AP_TRIB_SN, extractTag(regTrib ?? '', 'regApTribSN')),
    regEspTrib: desc(REG_ESP_TRIB, extractTag(regTrib ?? '', 'regEspTrib')),
  };

  const toma = parsePessoa(extractTag(dps, 'toma'));
  const interm = parsePessoa(extractTag(dps, 'interm'));

  const serv = extractTag(dps, 'serv') ?? '';
  const cServ = extractTag(serv, 'cServ') ?? '';
  const locPrest = extractTag(serv, 'locPrest') ?? '';

  const dpsValores = extractTag(dps, 'valores') ?? '';
  const trib = extractTag(dpsValores, 'trib') ?? '';
  const tribMun = extractTag(trib, 'tribMun') ?? '';
  const tribFed = extractTag(trib, 'tribFed') ?? '';
  const totTrib = extractTag(trib, 'totTrib') ?? '';

  const nfseValores = extractTag(nfse, 'valores') ?? '';
  const ibscbs = extractTag(nfse, 'IBSCBS') ?? '';
  const totCIBS = extractTag(ibscbs, 'totCIBS') ?? '';
  const gIBS = extractTag(totCIBS, 'gIBS') ?? '';
  const gCBS = extractTag(totCIBS, 'gCBS') ?? '';

  const servInfos = extractTag(dps, 'serv') ?? '';
  const infoCompl = extractTag(servInfos, 'infoCompl');
  const xOutInf = extractTag(nfse, 'xOutInf');

  const infoComplPartes = [
    infoCompl ? `Inf. Cont.: ${infoCompl}` : undefined,
    xOutInf ? `Inf. A. T. Mun.: ${xOutInf}` : undefined,
  ].filter((v) => v !== undefined);

  const vTotTrib = extractTag(totTrib, 'vTotTrib');
  const pTotTrib = extractTag(totTrib, 'pTotTrib');
  let totTribInfo: { fed?: string; est?: string; mun?: string } | undefined;
  if (vTotTrib) {
    totTribInfo = {
      fed: fmtMoney(extractTag(vTotTrib, 'vTotTribFed')),
      est: fmtMoney(extractTag(vTotTrib, 'vTotTribEst')),
      mun: fmtMoney(extractTag(vTotTrib, 'vTotTribMun')),
    };
    infoComplPartes.push(
      `Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: R$ ${totTribInfo.fed} ; Estaduais: R$ ${totTribInfo.est} ; Municipais: R$ ${totTribInfo.mun}`,
    );
  } else if (pTotTrib) {
    totTribInfo = {
      fed: fmtPct(extractTag(pTotTrib, 'pTotTribFed')),
      est: fmtPct(extractTag(pTotTrib, 'pTotTribEst')),
      mun: fmtPct(extractTag(pTotTrib, 'pTotTribMun')),
    };
    infoComplPartes.push(
      `Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: ${totTribInfo.fed} ; Estaduais: ${totTribInfo.est} ; Municipais: ${totTribInfo.mun}`,
    );
  }

  const tpAmb = (extractTag(dps, 'tpAmb') ?? '1') as '1' | '2';
  const dest = parsePessoa(extractTag(dps, 'dest'));

  return {
    chaveAcesso,
    nNFSe: extractTag(nfse, 'nNFSe'),
    dCompet: dataBr(extractTag(dps, 'dCompet')),
    dhProc: dataHoraBr(extractTag(nfse, 'dhProc')),
    nDPS: extractTag(dps, 'nDPS'),
    serie: extractTag(dps, 'serie'),
    dhEmi: dataHoraBr(extractTag(dps, 'dhEmi')),
    tpEmit: desc(TP_EMIT, extractTag(dps, 'tpEmit')),
    cStat: extractTag(nfse, 'cStat'),
    finNFSe: desc(FIN_NFSE, extractTag(dps, 'finNFSe')),
    xLocEmi: extractTag(nfse, 'xLocEmi'),
    ambGer: extractTag(nfse, 'ambGer'),
    tpAmb,
    prest,
    prestSn,
    toma,
    dest,
    interm,
    serv: {
      cTribNac: extractTag(cServ, 'cTribNac'),
      cTribMun: extractTag(cServ, 'cTribMun'),
      cNBS: extractTag(nfse, 'xNBS'),
      xLocPrestacao: extractTag(nfse, 'xLocPrestacao') ?? extractTag(locPrest, 'cLocPrestacao'),
      xTribNac: unescapeXml(extractTag(nfse, 'xTribNac')),
      xTribMun: unescapeXml(extractTag(nfse, 'xTribMun')),
      xDescServ: unescapeXml(extractTag(cServ, 'xDescServ')),
    },
    iss: {
      tribISSQN: desc(TRIB_ISSQN, extractTag(tribMun, 'tribISSQN')),
      xLocIncid: extractTag(tribMun, 'xLocIncid'),
      regEspTrib: desc(REG_ESP_TRIB, extractTag(tribMun, 'regEspTrib')),
      tpImunidade: extractTag(tribMun, 'tpImunidade'),
      tpSusp: extractTag(tribMun, 'tpSusp'),
      nProcesso: extractTag(tribMun, 'nProcesso'),
      tpBM: extractTag(tribMun, 'tpBM'),
      vCalcBM: fmtMoney(extractTag(tribMun, 'vCalcBM')),
      vDedRed: fmtMoney(extractTag(tribMun, 'vDedRed')),
      vDescIncond: fmtMoney(extractTag(tribMun, 'vDescIncond')),
      vBC: fmtMoney(extractTag(tribMun, 'vBC')),
      pAliq: fmtPct(extractTag(tribMun, 'pAliq')),
      tpRetISSQN: desc(TP_RET_ISSQN, extractTag(tribMun, 'tpRetISSQN')),
      vISSQN: fmtMoney(extractTag(tribMun, 'vISSQN')),
    },
    fed: {
      vRetIRRF: fmtMoney(extractTag(tribFed, 'vRetIRRF')),
      vRetCP: fmtMoney(extractTag(tribFed, 'vRetCP')),
      vRetCSLL: fmtMoney(extractTag(tribFed, 'vRetCSLL')),
      vPis: fmtMoney(extractTag(tribFed, 'vPis')),
      vCofins: fmtMoney(extractTag(tribFed, 'vCofins')),
      tpRetPisCofins: extractTag(tribFed, 'tpRetPisCofins'),
    },
    ibscbs: {
      cst: extractTag(ibscbs, 'CST'),
      cClassTrib: extractTag(ibscbs, 'cClassTrib'),
      cIndOp: extractTag(ibscbs, 'cIndOp'),
      xLocalidadeIncid: extractTag(ibscbs, 'xLocalidadeIncid'),
      vExclusoes: fmtMoney(extractTag(ibscbs, 'vExclusoes')),
      vBC: fmtMoney(extractTag(ibscbs, 'vBC')),
      pRedAliq: fmtPct(extractTag(ibscbs, 'pRedAliq')),
      pAliq: fmtPct(extractTag(ibscbs, 'pAliq')),
      pAliqEfetMun: fmtPct(extractTag(ibscbs, 'pAliqEfetMun')),
      vIBSMun: fmtMoney(extractTag(gIBS, 'vIBSMun')),
      pAliqEfetUF: fmtPct(extractTag(ibscbs, 'pAliqEfetUF')),
      vIBSUF: fmtMoney(extractTag(gIBS, 'vIBSUF')),
      vIBSTot: fmtMoney(extractTag(gIBS, 'vIBSTot')),
      pCBS: fmtPct(extractTag(ibscbs, 'pCBS')),
      pAliqEfetCBS: fmtPct(extractTag(ibscbs, 'pAliqEfetCBS')),
      vCBS: fmtMoney(extractTag(gCBS, 'vCBS')),
    },
    totais: {
      vServ: fmtMoney(
        extractTag(nfseValores, 'vServ') ??
          extractTag(extractTag(dpsValores, 'vServPrest') ?? '', 'vServ'),
      ),
      vDescIncond: fmtMoney(extractTag(nfseValores, 'vDescIncond')),
      vDescCond: fmtMoney(extractTag(nfseValores, 'vDescCond')),
      vTotalRet: fmtMoney(extractTag(nfseValores, 'vTotalRet')),
      vLiq: fmtMoney(extractTag(nfseValores, 'vLiq')),
      vIBSCBS: fmtMoney(extractTag(totCIBS, 'vIBSTot') ?? extractTag(gCBS, 'vCBS')),
      vTotNF: fmtMoney(extractTag(nfseValores, 'vTotNF')),
    },
    totTrib: totTribInfo,
    infoCompl: infoComplPartes.join(' | '),
    situacao: detectDanfseSituacao(xml),
  };
}

function wrapText(font: PDFFont, text: string, maxWidthPt: number, size: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidthPt) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Cell {
  wCm: number;
  label?: string;
  value?: string;
}

class DanfseRenderer {
  private yTop = 0; // cm a partir do topo
  private readonly page: PDFPage;
  private readonly font: PDFFont;
  private readonly bold: PDFFont;

  constructor(page: PDFPage, font: PDFFont, bold: PDFFont) {
    this.page = page;
    this.font = font;
    this.bold = bold;
  }

  private y(): number {
    return PAGE_H - this.yTop * CM;
  }

  getYTop(): number {
    return this.yTop;
  }

  box(xCm: number, wCm: number, hCm: number): void {
    this.page.drawRectangle({
      x: xCm * CM,
      y: this.y() - hCm * CM,
      width: wCm * CM,
      height: hCm * CM,
      borderColor: BLACK,
      borderWidth: 0.5,
    });
  }

  shade(xCm: number, wCm: number, hCm: number, color = SHADING): void {
    this.page.drawRectangle({
      x: xCm * CM,
      y: this.y() - hCm * CM,
      width: wCm * CM,
      height: hCm * CM,
      color,
    });
  }

  text(
    text: string,
    xCm: number,
    yTopCm: number,
    size: number,
    font: PDFFont,
    color = BLACK,
  ): void {
    this.page.drawText(text, {
      x: xCm * CM,
      y: PAGE_H - (yTopCm + (size / 72) * 2.54) * CM,
      size,
      font,
      color,
    });
  }

  blockTitle(text: string): void {
    const h = 0.55;
    this.shade(LEFT / CM, BODY_W / CM, h);
    this.box(LEFT / CM, BODY_W / CM, h);
    this.text(text.toUpperCase(), LEFT / CM + 0.1, this.yTop + 0.1, BLOCK_TITLE_SIZE, this.bold);
    this.yTop += h;
  }

  /**
   * Desenha uma linha de campos (label + conteúdo) com quebra de texto.
   * Os campos seguem o grid a partir da margem esquerda; conteúdo longo é
   * truncado para não estourar a altura da página (DANFSe é 1 página A4).
   * Retorna a altura efetivamente usada.
   */
  drawCells(cells: Cell[], labelSize = LABEL_SIZE, contentSize = CONTENT_SIZE): number {
    const gapCm = 0.05;
    const padCm = 0.06;
    const maxLines = 8;
    const x0 = LEFT / CM;
    const contentH = 0.4;

    let maxRowLines = 1;
    for (const cell of cells) {
      const value = cell.value === undefined || cell.value === '' ? '-' : cell.value;
      const maxWidth = (cell.wCm - padCm * 2) * CM;
      const lines = wrapText(this.font, value, maxWidth, contentSize).slice(0, maxLines);
      if (lines.length > maxRowLines) maxRowLines = lines.length;
    }

    const rowH = Math.max(0.7, contentH * maxRowLines + (labelSize / 72) * 2.54 + padCm * 2);
    let x = x0;
    for (const cell of cells) {
      const value = cell.value === undefined || cell.value === '' ? '-' : cell.value;
      this.box(x, cell.wCm, rowH);
      if (cell.label) {
        this.text(cell.label.toUpperCase(), x + padCm, this.yTop + padCm, labelSize, this.bold);
      }
      const maxWidth = (cell.wCm - padCm * 2) * CM;
      const lines = wrapText(this.font, value, maxWidth, contentSize).slice(0, maxLines);
      const lineHeight = (contentSize / 72) * 2.54 + 0.18;
      lines.forEach((line, i) => {
        this.text(
          line,
          x + padCm,
          this.yTop + padCm + (labelSize / 72) * 2.54 + 0.06 + i * lineHeight,
          contentSize,
          this.font,
        );
      });
      x += cell.wCm + gapCm;
    }
    this.yTop += rowH;
    return rowH;
  }

  skip(hCm: number): void {
    this.yTop += hCm;
  }
}

function isNotEmptyPessoa(p: DanfsePessoa | undefined): boolean {
  return p !== undefined && Object.values(p).some((v) => v !== undefined && v !== '');
}

function hasIss(data: DanfseData): boolean {
  return (
    data.iss !== undefined && Object.values(data.iss).some((v) => v !== undefined && v !== '-')
  );
}

function hasFed(data: DanfseData): boolean {
  return (
    data.fed !== undefined && Object.values(data.fed).some((v) => v !== undefined && v !== '-')
  );
}

function hasIbsCbs(data: DanfseData): boolean {
  return (
    data.ibscbs !== undefined &&
    Object.values(data.ibscbs).some((v) => v !== undefined && v !== '-')
  );
}

/**
 * Gera o PDF do DANFSe v2.0 a partir do XML da NFS-e (autorizado) em A4.
 */
export async function gerarDanfsePdf(xml: string): Promise<Uint8Array> {
  const data = parseNfseToDanfse(xml);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer('ZERA LOBONOTAS');
  pdfDoc.setCreator('ZERA LOBONOTAS');
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const r = new DanfseRenderer(page, font, bold);

  // ---- Cabeçalho -----------------------------------------------------------
  const headerH = 1.7;
  r.box(LEFT / CM, BODY_W / CM, headerH);
  r.text('NFS-e', LEFT / CM + 0.1, r.getYTop() + 0.45, HEADER_TITLE_SIZE, bold);
  r.text('DANFSe v2.0', LEFT / CM + 4.4, r.getYTop() + 0.25, HEADER_TITLE_SIZE, bold);
  r.text('Documento Auxiliar da NFS-e', LEFT / CM + 4.4, r.getYTop() + 0.75, 8, font);

  const rightColW = 5.1;
  const rightColX = RIGHT / CM - rightColW;
  r.text(data.xLocEmi ?? '-', rightColX + 0.1, r.getYTop() + 0.3, 8, font);
  const ambGer = data.ambGer ?? '-';
  const tpAmb = data.tpAmb ?? '-';
  r.text(`Ambiente gerador: ${ambGer}`, rightColX + 0.1, r.getYTop() + 0.75, 6, font);
  r.text(`Ambiente: ${desc(TP_AMB, tpAmb) ?? tpAmb}`, rightColX + 0.1, r.getYTop() + 1.0, 6, font);

  const qrUrl = `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${data.chaveAcesso}`;
  const qrPng = await QRCode.toBuffer(qrUrl, {
    type: 'png',
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  const qrImage = await pdfDoc.embedPng(qrPng);
  const qrSize = 1.42 * CM;
  r.text('QR Code', rightColX + 0.1, r.getYTop() + 0.0, 6, bold);
  page.drawImage(qrImage, {
    x: rightColX * CM + 0.2 * CM,
    y: PAGE_H - (r.getYTop() + 0.25) * CM - qrSize,
    width: qrSize,
    height: qrSize,
  });

  r.skip(headerH);

  if (data.tpAmb === '2') {
    r.text(
      'NFS-e SEM VALIDADE JURÍDICA',
      LEFT / CM + 4.4,
      r.getYTop() - 0.55,
      HEADER_TITLE_SIZE,
      bold,
      RED,
    );
  }

  // ---- Dados da NFS-e -------------------------------------------------------
  r.blockTitle('Dados da NFS-e');
  r.drawCells([{ wCm: 15.3, label: 'Chave de Acesso da NFS-e', value: data.chaveAcesso || '-' }]);
  r.drawCells([
    { wCm: 6.6, label: 'Número da NFS-e', value: data.nNFSe },
    { wCm: 6.6, label: 'Competência', value: data.dCompet },
    { wCm: 7.2, label: 'Data e Hora da Emissão da NFS-e', value: data.dhProc },
  ]);
  r.drawCells([
    { wCm: 6.6, label: 'Número da DPS', value: data.nDPS },
    { wCm: 6.6, label: 'Série da DPS', value: data.serie },
    { wCm: 7.2, label: 'Data e Hora da Emissão da DPS', value: data.dhEmi },
  ]);
  r.drawCells([
    { wCm: 6.6, label: 'Emitente da NFS-e', value: data.tpEmit },
    { wCm: 6.6, label: 'Situação da NFS-e', value: data.cStat },
    { wCm: 7.2, label: 'Finalidade', value: data.finNFSe },
  ]);

  // ---- Prestador ------------------------------------------------------------
  r.blockTitle('Prestador / Fornecedor');
  r.drawCells([
    { wCm: 5.1, label: 'CNPJ / CPF / NIF', value: data.prest.documento },
    { wCm: 5.1, label: 'Indicador Municipal (Inscrição)', value: data.prest.im },
    { wCm: 5.1, label: 'Telefone', value: data.prest.fone },
    { wCm: 5.1, label: 'E-mail', value: data.prest.email },
  ]);
  r.drawCells([
    { wCm: 10.2, label: 'Nome / Nome Empresarial', value: data.prest.xNome },
    { wCm: 5.1, label: 'Município / Sigla UF', value: data.prest.municipioUf },
    {
      wCm: 5.1,
      label: 'Código IBGE / CEP',
      value: [data.prest.cMun, data.prest.cep].filter(Boolean).join(' / ') || undefined,
    },
  ]);
  if (data.prest.endereco) {
    r.drawCells([{ wCm: 20.4, label: 'Endereço', value: data.prest.endereco }]);
  }
  const sn = data.prestSn;
  r.drawCells([
    { wCm: 10.2, label: 'Simples Nacional na Data de Competência', value: sn?.opSimpNac },
    { wCm: 10.2, label: 'Regime de Apuração Tributária pelo SN', value: sn?.regApTribSN },
  ]);

  // ---- Tomador --------------------------------------------------------------
  if (isNotEmptyPessoa(data.toma)) {
    r.blockTitle('Tomador / Adquirente');
    r.drawCells([
      { wCm: 5.1, label: 'CNPJ / CPF / NIF', value: data.toma?.documento },
      { wCm: 5.1, label: 'Indicador Municipal (Inscrição)', value: data.toma?.im },
      { wCm: 5.1, label: 'Telefone', value: data.toma?.fone },
      { wCm: 5.1, label: 'E-mail', value: data.toma?.email },
    ]);
    r.drawCells([
      { wCm: 10.2, label: 'Nome / Nome Empresarial', value: data.toma?.xNome },
      { wCm: 5.1, label: 'Município / Sigla UF', value: data.toma?.municipioUf },
      {
        wCm: 5.1,
        label: 'Código IBGE / CEP',
        value: [data.toma?.cMun, data.toma?.cep].filter(Boolean).join(' / ') || undefined,
      },
    ]);
    if (data.toma?.endereco) {
      r.drawCells([{ wCm: 20.4, label: 'Endereço', value: data.toma.endereco }]);
    }
  } else {
    r.blockTitle('Tomador / Adquirente');
    r.drawCells([
      {
        wCm: 20.4,
        label: undefined,
        value: 'TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e',
      },
    ]);
  }

  // ---- Destinatário ---------------------------------------------------------
  if (isNotEmptyPessoa(data.dest)) {
    r.blockTitle('Destinatário da Operação');
    r.drawCells([
      { wCm: 5.1, label: 'CNPJ / CPF / NIF', value: data.dest?.documento },
      { wCm: 5.1, label: 'Telefone', value: data.dest?.fone },
      { wCm: 5.1, label: 'Município / Sigla UF', value: data.dest?.municipioUf },
      {
        wCm: 5.1,
        label: 'Código IBGE / CEP',
        value: [data.dest?.cMun, data.dest?.cep].filter(Boolean).join(' / ') || undefined,
      },
    ]);
    r.drawCells([
      { wCm: 10.2, label: 'Nome / Nome Empresarial', value: data.dest?.xNome },
      { wCm: 10.2, label: 'E-mail', value: data.dest?.email },
    ]);
    if (data.dest?.endereco) {
      r.drawCells([{ wCm: 20.4, label: 'Endereço', value: data.dest.endereco }]);
    }
  }

  // ---- Intermediário --------------------------------------------------------
  if (isNotEmptyPessoa(data.interm)) {
    r.blockTitle('Intermediário da Operação');
    r.drawCells([
      { wCm: 5.1, label: 'CNPJ / CPF / NIF', value: data.interm?.documento },
      { wCm: 5.1, label: 'Indicador Municipal (Inscrição)', value: data.interm?.im },
      { wCm: 5.1, label: 'Telefone', value: data.interm?.fone },
      { wCm: 5.1, label: 'E-mail', value: data.interm?.email },
    ]);
    r.drawCells([
      { wCm: 10.2, label: 'Nome / Nome Empresarial', value: data.interm?.xNome },
      { wCm: 5.1, label: 'Município / Sigla UF', value: data.interm?.municipioUf },
      {
        wCm: 5.1,
        label: 'Código IBGE / CEP',
        value: [data.interm?.cMun, data.interm?.cep].filter(Boolean).join(' / ') || undefined,
      },
    ]);
    if (data.interm?.endereco) {
      r.drawCells([{ wCm: 20.4, label: 'Endereço', value: data.interm.endereco }]);
    }
  }

  // ---- Serviço Prestado -----------------------------------------------------
  r.blockTitle('Serviço Prestado');
  r.drawCells([
    {
      wCm: 5.1,
      label: 'Código de Tributação Nacional / Municipal',
      value: [data.serv.cTribNac, data.serv.cTribMun].filter(Boolean).join(' / ') || undefined,
    },
    { wCm: 5.1, label: 'Código da NBS', value: data.serv.cNBS },
    { wCm: 5.1, label: 'Local da Prestação', value: data.serv.xLocPrestacao },
    {
      wCm: 5.1,
      label: 'Descrição do Código de Tributação',
      value: data.serv.xTribMun ?? data.serv.xTribNac,
    },
  ]);
  r.drawCells([{ wCm: 20.4, label: 'Descrição do Serviço', value: data.serv.xDescServ }]);

  // ---- Tributação Municipal (ISSQN) ----------------------------------------
  if (hasIss(data)) {
    r.blockTitle('Tributação Municipal (ISSQN)');
    r.drawCells([
      { wCm: 5.1, label: 'Tipo de Tributação do ISSQN', value: data.iss?.tribISSQN },
      { wCm: 5.1, label: 'Município / UF / País de Incidência', value: data.iss?.xLocIncid },
      { wCm: 5.1, label: 'Regime Especial de Tributação', value: data.iss?.regEspTrib },
      { wCm: 5.1, label: 'Tipo de Imunidade', value: data.iss?.tpImunidade },
    ]);
    r.drawCells([
      { wCm: 5.1, label: 'Suspensão da Exigibilidade', value: data.iss?.tpSusp },
      { wCm: 5.1, label: 'Número Processo Suspensão', value: data.iss?.nProcesso },
      { wCm: 5.1, label: 'Benefício Municipal', value: data.iss?.tpBM },
      { wCm: 5.1, label: 'Cálculo do BM', value: data.iss?.vCalcBM },
    ]);
    r.drawCells([
      { wCm: 5.1, label: 'Total Deduções/Reduções', value: data.iss?.vDedRed },
      { wCm: 5.1, label: 'Desconto Incondicionado', value: data.iss?.vDescIncond },
      { wCm: 5.1, label: 'BC ISSQN', value: data.iss?.vBC },
      { wCm: 5.1, label: 'Alíquota Aplicada', value: data.iss?.pAliq },
    ]);
    r.drawCells([
      { wCm: 6.8, label: 'Retenção do ISSQN', value: data.iss?.tpRetISSQN },
      { wCm: 6.8, label: 'ISSQN Apurado', value: data.iss?.vISSQN },
      { wCm: 6.8, label: undefined, value: undefined },
    ]);
  }

  // ---- Tributação Federal (Exceto CBS) --------------------------------------
  if (hasFed(data)) {
    r.blockTitle('Tributação Federal (Exceto CBS)');
    r.drawCells([
      { wCm: 5.1, label: 'IRRF', value: data.fed?.vRetIRRF },
      { wCm: 5.1, label: 'Contribuição Previdenciária - Retida', value: data.fed?.vRetCP },
      { wCm: 5.1, label: 'Contribuições Sociais - Retidas', value: data.fed?.vRetCSLL },
      { wCm: 5.1, label: 'PIS - Débito Apuração Própria', value: data.fed?.vPis },
    ]);
    r.drawCells([
      { wCm: 10.2, label: 'COFINS - Débito Apuração Própria', value: data.fed?.vCofins },
      { wCm: 10.2, label: 'Descrição Contrib. Sociais - Retidas', value: data.fed?.tpRetPisCofins },
    ]);
  }

  // ---- Tributação IBS / CBS -------------------------------------------------
  if (hasIbsCbs(data)) {
    r.blockTitle('Tributação IBS / CBS');
    r.drawCells([
      {
        wCm: 6.8,
        label: 'CST / cClassTrib',
        value: [data.ibscbs?.cst, data.ibscbs?.cClassTrib].filter(Boolean).join(' / ') || undefined,
      },
      { wCm: 6.8, label: 'Indicador de Operação', value: data.ibscbs?.cIndOp },
      { wCm: 6.8, label: 'Município de Incidência', value: data.ibscbs?.xLocalidadeIncid },
    ]);
    r.drawCells([
      { wCm: 5.1, label: 'Exclusões e Reduções da BC', value: data.ibscbs?.vExclusoes },
      { wCm: 5.1, label: 'BC Após Exclusões e Reduções', value: data.ibscbs?.vBC },
      { wCm: 5.1, label: 'Reduções da Alíquota (IBS/CBS)', value: data.ibscbs?.pRedAliq },
      { wCm: 5.1, label: 'Alíquota (IBS UF/Mun)', value: data.ibscbs?.pAliq },
    ]);
    r.drawCells([
      { wCm: 5.1, label: 'Alíq. Efetiva Municipal - IBS', value: data.ibscbs?.pAliqEfetMun },
      { wCm: 5.1, label: 'Valor Apurado Municipal - IBS', value: data.ibscbs?.vIBSMun },
      { wCm: 5.1, label: 'Alíq. Efetiva Estadual - IBS', value: data.ibscbs?.pAliqEfetUF },
      { wCm: 5.1, label: 'Valor Apurado Estadual - IBS', value: data.ibscbs?.vIBSUF },
    ]);
    r.drawCells([
      { wCm: 5.1, label: 'Valor Total Apurado - IBS', value: data.ibscbs?.vIBSTot },
      { wCm: 5.1, label: 'Alíquota - CBS', value: data.ibscbs?.pCBS },
      { wCm: 5.1, label: 'Alíquota Efetiva - CBS', value: data.ibscbs?.pAliqEfetCBS },
      { wCm: 5.1, label: 'Valor Total Apurado - CBS', value: data.ibscbs?.vCBS },
    ]);
  }

  // ---- Valor Total da NFS-e -------------------------------------------------
  r.blockTitle('Valor Total da NFS-e');
  r.drawCells([
    { wCm: 5.1, label: 'Valor da Operação / Serviço', value: data.totais.vServ },
    { wCm: 5.1, label: 'Desconto Incondicionado', value: data.totais.vDescIncond },
    { wCm: 5.1, label: 'Desconto Condicionado', value: data.totais.vDescCond },
    { wCm: 5.1, label: 'Total das Retenções', value: data.totais.vTotalRet },
  ]);
  r.drawCells([
    { wCm: 5.1, label: 'Valor Líquido da NFS-e', value: data.totais.vLiq },
    { wCm: 5.1, label: 'Total do IBS/CBS', value: data.totais.vIBSCBS },
    { wCm: 5.1, label: 'Valor Líquido da NFS-e + IBS/CBS', value: data.totais.vTotNF },
    { wCm: 5.1, label: undefined, value: undefined },
  ]);

  // ---- Informações Complementares -------------------------------------------
  if (data.infoCompl) {
    r.blockTitle('Informações Complementares');
    r.drawCells([{ wCm: 20.4, label: undefined, value: data.infoCompl }]);
  }

  // ---- Canhoto (opcional) ---------------------------------------------------
  const canhotoY = 27.6;
  if (r.getYTop() < canhotoY) {
    r.skip(canhotoY - r.getYTop());
    r.blockTitle('Canhoto');
    r.drawCells([
      { wCm: 6.8, label: 'Data de cientificação', value: undefined },
      { wCm: 6.8, label: 'Identificação e Assinatura', value: undefined },
      {
        wCm: 6.8,
        label: 'Nº NFS-e / Chave NFS-e',
        value: [data.nNFSe, data.chaveAcesso].filter(Boolean).join(' / ') || undefined,
      },
    ]);
  }

  // ---- Marca d'água ---------------------------------------------------------
  if (data.situacao) {
    const label = data.situacao === 'CANCELADA' ? 'CANCELADA' : 'SUBSTITUÍDA';
    page.drawText(label, {
      x: PAGE_W / 2,
      y: PAGE_H / 2,
      size: 50,
      font: bold,
      color: WATERMARK,
      rotate: degrees(45),
    });
  }

  // ---- Borda da página ------------------------------------------------------
  page.drawRectangle({
    x: 0.1 * CM,
    y: 0.1 * CM,
    width: PAGE_W - 0.2 * CM,
    height: PAGE_H - 0.2 * CM,
    borderColor: BLACK,
    borderWidth: 1,
  });

  return pdfDoc.save();
}
