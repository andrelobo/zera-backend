import { LobonotasConfig, normalizeCnpj, parseCnpjAllowlist } from './lobonotas.config';

describe('parseCnpjAllowlist', () => {
  const original = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...original };
  });

  afterAll(() => {
    process.env = original;
  });

  it('retorna lista vazia quando ausente', () => {
    expect(parseCnpjAllowlist(undefined)).toEqual([]);
  });

  it('normaliza CNPJs com máscara e ignora entradas inválidas', () => {
    expect(parseCnpjAllowlist('12.345.678/0001-90, 999, 11.222.333/0001-81')).toEqual([
      '12345678000190',
      '11222333000181',
    ]);
  });

  it('remove duplicados', () => {
    expect(parseCnpjAllowlist('12345678000190,12345678000190')).toEqual(['12345678000190']);
  });

  it('normalizeCnpj remove tudo que não é dígito', () => {
    expect(normalizeCnpj('12.345.678/0001-90')).toBe('12345678000190');
  });
});

describe('LobonotasConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });

  it('piloto desligado por default', () => {
    delete process.env.LOBONOTAS_PILOT_ENABLED;
    delete process.env.LOBONOTAS_CNPJS_MANAUS;
    const config = new LobonotasConfig();
    expect(config.pilotEnabled).toBe(false);
    expect(config.pilotCnpjs).toEqual([]);
    expect(config.isPilotoCnpj('12345678000190')).toBe(false);
  });

  it('piloto ligado e CNPJ na allowlist é roteado', () => {
    process.env.LOBONOTAS_PILOT_ENABLED = 'true';
    process.env.LOBONOTAS_CNPJS_MANAUS = '12.345.678/0001-90';
    const config = new LobonotasConfig();
    expect(config.pilotEnabled).toBe(true);
    expect(config.isPilotoCnpj('12345678000190')).toBe(true);
    expect(config.isPilotoCnpj('12345678000191')).toBe(false);
  });

  it('CNPJ fora da allowlist não é piloto mesmo com flag ligada', () => {
    process.env.LOBONOTAS_PILOT_ENABLED = '1';
    process.env.LOBONOTAS_CNPJS_MANAUS = '11222333000181';
    const config = new LobonotasConfig();
    expect(config.isPilotoCnpj('43521115000134')).toBe(false);
  });

  it('CNPJ com formato inválido nunca é piloto', () => {
    process.env.LOBONOTAS_PILOT_ENABLED = 'true';
    process.env.LOBONOTAS_CNPJS_MANAUS = '12345678000190';
    const config = new LobonotasConfig();
    expect(config.isPilotoCnpj('123')).toBe(false);
    expect(config.isPilotoCnpj(undefined)).toBe(false);
  });
});
