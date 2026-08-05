import { FiscalProviderResolver } from './fiscal-provider.resolver';
import { LobonotasConfig } from '../infra/sefin/lobonotas.config';
import { LOBONOTAS_PROVIDER, PLUGNOTAS_PROVIDER } from '../domain/provider-names';

describe('FiscalProviderResolver', () => {
  const originalEnv = { ...process.env };

  const plugNotasProvider = { providerName: PLUGNOTAS_PROVIDER } as any;
  const lobonotasProvider = { providerName: LOBONOTAS_PROVIDER } as any;

  function makeResolver() {
    return new FiscalProviderResolver(plugNotasProvider, lobonotasProvider, new LobonotasConfig());
  }

  beforeEach(() => {
    delete process.env.FISCAL_PROVIDER_ACTIVE;
    delete process.env.SEFIN_ENABLED;
    delete process.env.LOBONOTAS_PILOT_ENABLED;
    delete process.env.LOBONOTAS_CNPJS_MANAUS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolve sempre retorna LOBONOTAS (unico provider operacional)', () => {
    expect(makeResolver().resolve()).toBe(lobonotasProvider);
  });

  it('PLUGNOTAS nunca e ativo, mesmo com env explicito FISCAL_PROVIDER_ACTIVE=PLUGNOTAS', () => {
    process.env.FISCAL_PROVIDER_ACTIVE = PLUGNOTAS_PROVIDER;
    const resolver = makeResolver();
    expect(resolver.resolve()).toBe(lobonotasProvider);
    expect(resolver.isActive(PLUGNOTAS_PROVIDER)).toBe(false);
  });

  it('FISCAL_PROVIDER_ACTIVE=LOBONOTAS resolve LOBONOTAS', () => {
    process.env.FISCAL_PROVIDER_ACTIVE = LOBONOTAS_PROVIDER;
    expect(makeResolver().resolve()).toBe(lobonotasProvider);
  });

  it('SEFIN_ENABLED (env legado) nao muda o provider operacional', () => {
    process.env.SEFIN_ENABLED = 'false';
    expect(makeResolver().resolve()).toBe(lobonotasProvider);
    process.env.SEFIN_ENABLED = 'true';
    expect(makeResolver().resolve()).toBe(lobonotasProvider);
  });

  it('isActive reflete apenas LOBONOTAS', () => {
    const resolver = makeResolver();
    expect(resolver.isActive(PLUGNOTAS_PROVIDER)).toBe(false);
    expect(resolver.isActive(LOBONOTAS_PROVIDER)).toBe(true);
  });

  it('byProviderName mantem PLUGNOTAS registrado para leitura historica e falha para desconhecido', () => {
    const resolver = makeResolver();
    expect(resolver.byProviderName(PLUGNOTAS_PROVIDER)).toBe(plugNotasProvider);
    expect(() => resolver.byProviderName('X')).toThrow(
      expect.objectContaining({ code: 'FISCAL_PROVIDER_UNKNOWN' }),
    );
  });

  it('resolveProviderForCnpj sempre roteia para LOBONOTAS, independente do piloto', () => {
    process.env.LOBONOTAS_PILOT_ENABLED = 'true';
    process.env.LOBONOTAS_CNPJS_MANAUS = '12.345.678/0001-90';
    const resolver = makeResolver();
    expect(resolver.resolveProviderForCnpj('12345678000190')).toBe(lobonotasProvider);
    expect(resolver.resolveProviderForCnpj('43521115000134')).toBe(lobonotasProvider);
    expect(resolver.resolveProviderForCnpj(undefined)).toBe(lobonotasProvider);

    process.env.LOBONOTAS_PILOT_ENABLED = 'false';
    expect(resolver.resolveProviderForCnpj('43521115000134')).toBe(lobonotasProvider);
  });

  it('pollingProviderNames cobre apenas LOBONOTAS (PlugNotas nunca e poliada)', () => {
    const resolver = makeResolver();
    expect(resolver.pollingProviderNames()).toEqual([LOBONOTAS_PROVIDER]);

    process.env.FISCAL_PROVIDER_ACTIVE = PLUGNOTAS_PROVIDER;
    expect(resolver.pollingProviderNames()).toEqual([LOBONOTAS_PROVIDER]);
  });
});
