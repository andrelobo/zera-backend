import type { EmitirNfseInput } from '../../domain/types/emitir-nfse.types';

export const DPS_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
export const DPS_VERSION = '1.01';

export interface DpsBuilderOptions {
  serie: string;
  nDPS: string;
  cLocEmi: string;
  tpAmb?: '1' | '2';
  dhEmi?: string;
  verAplic?: string;
  dCompet?: string;
  cLocPrestacao?: string;
  codigoTributacaoNacional?: string;
  tomadorCodigoMunicipio?: string;
  cMotivoSubstituicao?: string;
}

function onlyDigits(value?: string | number | null): string {
  return String(value ?? '').replace(/\D+/g, '');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toDecimalString(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

function toData(value?: string): string | undefined {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return undefined;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

const EMISSAO_TIME_ZONE = 'America/Manaus';

function toDate(value?: string): Date {
  if (!value) return new Date();
  const cleaned = value.replace(/\.\d{3}Z$/, 'Z').replace(/\.\d{3}[+-]\d{2}:\d{2}$/, 'Z');
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatZonedDateTime(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  const wallMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = wallMs - (date.getTime() - date.getMilliseconds());
  const sign = offsetMs < 0 ? '-' : '+';
  const abs = Math.abs(offsetMs);
  const hh = String(Math.floor(abs / 3_600_000)).padStart(2, '0');
  const mm = String(Math.floor((abs % 3_600_000) / 60_000)).padStart(2, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${hh}:${mm}`;
}

/**
 * Data/hora no fuso local de emissão (America/Manaus, UTC-4). O Ambiente
 * Nacional compara o relógio de parede sem normalizar offsets: valores em UTC
 * (+00:00) parecem ser "posteriores" ao processamento local (-03:00) e são
 * rejeitados com E0008. Os retornos reais do SEFIN também chegam em -04:00.
 */
export function toDateTimeLocal(value?: string, timeZone: string = EMISSAO_TIME_ZONE): string {
  return formatZonedDateTime(toDate(value), timeZone);
}

export function buildDpsId(opts: {
  cLocEmi: string;
  cnpjPrestador: string;
  serie: string;
  nDPS: string;
}): string {
  const cMun = onlyDigits(opts.cLocEmi).padStart(7, '0');
  const inscricao = onlyDigits(opts.cnpjPrestador);
  const tipoInscricao = inscricao.length === 14 ? '2' : '1';
  const inscricao14 = inscricao.padStart(14, '0');
  const serie = onlyDigits(opts.serie).padStart(5, '0');
  const nDps = onlyDigits(opts.nDPS).padStart(15, '0');
  return `DPS${cMun}${tipoInscricao}${inscricao14}${serie}${nDps}`;
}

function resolveCnpjOrCpf(documento: string): { tag: 'CNPJ' | 'CPF'; value: string } {
  const digits = onlyDigits(documento);
  if (digits.length === 14) return { tag: 'CNPJ', value: digits };
  if (digits.length === 11) return { tag: 'CPF', value: digits };
  throw new Error(`documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos, recebido: ${documento}`);
}

function hasSimplesSemRetencao(input: EmitirNfseInput): boolean {
  return (
    input.prestador.regimeTributarioSn?.opSimpNac === 3 &&
    input.prestador.regimeTributarioSn?.regApTribSN === 1 &&
    input.servico.iss?.retido === false
  );
}

function buildRegTrib(input: EmitirNfseInput): string {
  const regime = input.prestador.regimeTributarioSn;
  if (!regime) {
    throw new Error('prestador.regimeTributarioSn é obrigatório para a DPS');
  }
  const parts: string[] = [];
  if (regime.opSimpNac !== undefined && regime.opSimpNac !== null) {
    parts.push(`<opSimpNac>${regime.opSimpNac}</opSimpNac>`);
  }
  if (regime.regApTribSN !== undefined && regime.regApTribSN !== null) {
    parts.push(`<regApTribSN>${regime.regApTribSN}</regApTribSN>`);
  }
  if (regime.regEspTrib !== undefined && regime.regEspTrib !== null) {
    parts.push(`<regEspTrib>${regime.regEspTrib}</regEspTrib>`);
  }
  if (
    !parts.some((part) => part.includes('opSimpNac')) ||
    !parts.some((part) => part.includes('regEspTrib'))
  ) {
    throw new Error(
      'prestador.regimeTributarioSn.opSimpNac e regEspTrib são obrigatórios para a DPS',
    );
  }
  return `<regTrib>${parts.join('')}</regTrib>`;
}

function buildPrest(input: EmitirNfseInput): string {
  const { tag, value } = resolveCnpjOrCpf(input.prestador.cnpj);
  const parts: string[] = [`<${tag}>${value}</${tag}>`];
  const im = input.prestador.inscricaoMunicipal?.trim();
  if (im) parts.push(`<IM>${escapeXml(im)}</IM>`);
  const nome = input.prestador.razaoSocial?.trim();
  if (nome) parts.push(`<xNome>${escapeXml(nome)}</xNome>`);
  parts.push(buildRegTrib(input));
  return `<prest>${parts.join('')}</prest>`;
}

function buildToma(input: EmitirNfseInput): string {
  const { tag, value } = resolveCnpjOrCpf(input.tomador.cpfCnpj);
  const parts: string[] = [`<${tag}>${value}</${tag}>`];
  const im = input.tomador.inscricaoMunicipal?.trim();
  if (im) parts.push(`<IM>${escapeXml(im)}</IM>`);
  parts.push(`<xNome>${escapeXml(input.tomador.razaoSocial.trim())}</xNome>`);
  const email = input.tomador.email?.trim();
  if (email) parts.push(`<email>${escapeXml(email)}</email>`);
  return `<toma>${parts.join('')}</toma>`;
}

function buildServ(input: EmitirNfseInput, options: DpsBuilderOptions): string {
  const codigoNacional = options.codigoTributacaoNacional ?? input.servico.codigoNacional;
  const cTribNac = onlyDigits(codigoNacional);
  if (cTribNac.length !== 6) {
    throw new Error('servico.codigoNacional deve conter exatamente 6 dígitos para cTribNac');
  }
  const cLocPrestacao = options.cLocPrestacao ?? input.localPrestacao?.municipio;
  const cLocPrestacaoDigits = onlyDigits(cLocPrestacao);
  const locPrest =
    cLocPrestacaoDigits.length === 7
      ? `<locPrest><cLocPrestacao>${cLocPrestacaoDigits}</cLocPrestacao></locPrest>`
      : `<locPrest><cLocPrestacao>${options.cLocEmi}</cLocPrestacao></locPrest>`;

  const parts: string[] = [`<cTribNac>${cTribNac}</cTribNac>`];
  const cTribMun = input.servico.codigoTributacao?.trim();
  if (cTribMun) parts.push(`<cTribMun>${escapeXml(cTribMun)}</cTribMun>`);
  parts.push(`<xDescServ>${escapeXml(input.servico.descricao.trim())}</xDescServ>`);

  return `<serv>${locPrest}<cServ>${parts.join('')}</cServ></serv>`;
}

function buildTrib(input: EmitirNfseInput): string {
  const iss = input.servico.iss;
  const tpRetIssqn = iss?.retido ? '2' : '1';
  const omitirAliq = hasSimplesSemRetencao(input);
  const pAliq =
    !omitirAliq && iss?.aliquota !== undefined && iss.aliquota !== null
      ? `<pAliq>${iss.aliquota.toFixed(1)}</pAliq>`
      : '';

  const tribMun = `<tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>${tpRetIssqn}</tpRetISSQN>${pAliq}</tribMun>`;

  const ret = input.servico.retencoesFederais;
  const tribFedParts: string[] = [];
  if (ret) {
    if (ret.ir !== undefined && ret.ir !== null)
      tribFedParts.push(`<vRetIRRF>${toDecimalString(ret.ir)}</vRetIRRF>`);
    if (ret.csll !== undefined && ret.csll !== null)
      tribFedParts.push(`<vRetCSLL>${toDecimalString(ret.csll)}</vRetCSLL>`);
    if (ret.inss !== undefined && ret.inss !== null)
      tribFedParts.push(`<vRetCP>${toDecimalString(ret.inss)}</vRetCP>`);
  }
  const tribFed = tribFedParts.length > 0 ? `<tribFed>${tribFedParts.join('')}</tribFed>` : '';

  const tot = input.servico.tributacaoTotal;
  let totTrib: string;
  const hasValor =
    tot?.federal?.valor !== undefined ||
    tot?.estadual?.valor !== undefined ||
    tot?.municipal?.valor !== undefined;
  const hasPercentual =
    tot?.federal?.valorPercentual !== undefined ||
    tot?.estadual?.valorPercentual !== undefined ||
    tot?.municipal?.valorPercentual !== undefined;
  if (hasValor) {
    totTrib = `<totTrib><vTotTrib><vTotTribFed>${toDecimalString(tot?.federal?.valor)}</vTotTribFed><vTotTribEst>${toDecimalString(tot?.estadual?.valor)}</vTotTribEst><vTotTribMun>${toDecimalString(tot?.municipal?.valor)}</vTotTribMun></vTotTrib></totTrib>`;
  } else if (hasPercentual) {
    const pct = (v: number | undefined) => (v === undefined ? '0.00' : v.toFixed(2));
    totTrib = `<totTrib><pTotTrib><pTotTribFed>${pct(tot?.federal?.valorPercentual)}</pTotTribFed><pTotTribEst>${pct(tot?.estadual?.valorPercentual)}</pTotTribEst><pTotTribMun>${pct(tot?.municipal?.valorPercentual)}</pTotTribMun></pTotTrib></totTrib>`;
  } else {
    totTrib = `<totTrib><indTotTrib>0</indTotTrib></totTrib>`;
  }

  const vDescIncond =
    input.servico.desconto !== undefined && input.servico.desconto !== null
      ? `<vDescCondIncond><vDescIncond>${toDecimalString(input.servico.desconto)}</vDescIncond></vDescCondIncond>`
      : '';

  return `<valores><vServPrest><vServ>${toDecimalString(input.servico.valor)}</vServ></vServPrest>${vDescIncond}<trib>${tribMun}${tribFed}${totTrib}</trib></valores>`;
}

function buildSubst(input: EmitirNfseInput, options: DpsBuilderOptions): string {
  if (!input.substituicao) return '';
  const chSubstda = onlyDigits(input.idNotaSubstituida);
  if (chSubstda.length !== 50) {
    throw new Error('idNotaSubstituida deve conter a chave da NFS-e (50 dígitos)');
  }
  return `<subst><chSubstda>${chSubstda}</chSubstda><cMotivo>${options.cMotivoSubstituicao ?? '99'}</cMotivo></subst>`;
}

export function buildDps(input: EmitirNfseInput, options: DpsBuilderOptions): string {
  const cnpjPrestador = onlyDigits(input.prestador.cnpj);
  if (cnpjPrestador.length !== 14) {
    throw new Error('prestador.cnpj deve conter 14 dígitos para emissão da DPS');
  }
  const cLocEmi = onlyDigits(options.cLocEmi);
  if (cLocEmi.length !== 7) {
    throw new Error('options.cLocEmi deve conter o código IBGE do município emissor (7 dígitos)');
  }
  const serie = onlyDigits(options.serie);
  const nDps = onlyDigits(options.nDPS);
  if (serie.length < 1 || serie.length > 5) {
    throw new Error('options.serie deve ter entre 1 e 5 dígitos');
  }
  if (!/^[1-9][0-9]{0,14}$/.test(nDps)) {
    throw new Error('options.nDPS deve ser numérico sem zeros à esquerda (até 15 dígitos)');
  }

  const id = buildDpsId({ cLocEmi, cnpjPrestador, serie, nDPS: nDps });
  const dhEmi = toDateTimeLocal(options.dhEmi);
  const dCompet =
    toData(options.dCompet) ??
    toData(input.competencia) ??
    toData(input.dataEmissao) ??
    new Date().toISOString().slice(0, 10);
  const verAplic = options.verAplic ?? process.env.NFSE_VER_APLIC ?? 'ZERA-1.0';
  const tpAmb = options.tpAmb ?? process.env.NFSE_TP_AMB ?? '1';

  const infDps = [
    `<tpAmb>${tpAmb}</tpAmb>`,
    `<dhEmi>${dhEmi}</dhEmi>`,
    `<verAplic>${escapeXml(verAplic)}</verAplic>`,
    `<serie>${serie.padStart(5, '0')}</serie>`,
    `<nDPS>${nDps}</nDPS>`,
    `<dCompet>${dCompet}</dCompet>`,
    '<tpEmit>1</tpEmit>',
    `<cLocEmi>${cLocEmi}</cLocEmi>`,
    buildSubst(input, options),
    buildPrest(input),
    buildToma(input),
    buildServ(input, options),
    buildTrib(input),
  ].join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DPS xmlns="${DPS_NAMESPACE}" versao="${DPS_VERSION}">` +
    `<infDPS Id="${id}">${infDps}</infDPS>` +
    '</DPS>'
  );
}
