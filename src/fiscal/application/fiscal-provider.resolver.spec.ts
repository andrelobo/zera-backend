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

  it('default resolve retorna PLUGNOTAS (comportamento legado)', () => {
    expect(makeResolver().resolve()).toBe(plugNotasProvider);
  });

  it('SEFIN_ENABLED=true (env legado) resolve LOBONOTAS', () => {
    process.env.SEFIN_ENABLED = 'true';
    expect(makeResolver().resolve()).toBe(lobonotasProvider);
  });

  it('FISCAL_PROVIDER_ACTIVE=LOBONOTAS resolve LOBONOTAS', () => {
    process.env.FISCAL_PROVIDER_ACTIVE = LOBONOTAS_PROVIDER;
    expect(makeResolver().resolve()).toBe(lobonotasProvider);
  });

  it('FISCAL_PROVIDER_ACTIVE desconhecido falha fechado (FISCAL_PROVIDER_UNKNOWN)', () => {
    process.env.FISCAL_PROVIDER_ACTIVE = 'NUVERFISCAL';
    expect(() => makeResolver().resolve()).toThrow(
      expect.objectContaining({ code: 'FISCAL_PROVIDER_UNKNOWN' }),
    );
  });

  it('isActive reflete o provider ativo', () => {
    const resolver = makeResolver();
    expect(resolver.isActive(PLUGNOTAS_PROVIDER)).toBe(true);
    expect(resolver.isActive(LOBONOTAS_PROVIDER)).toBe(false);
  });

  it('byProviderName retorna provider registrado e falha para desconhecido', () => {
    const resolver = makeResolver();
    expect(resolver.byProviderName(PLUGNOTAS_PROVIDER)).toBe(plugNotasProvider);
    expect(() => resolver.byProviderName('X')).toThrow(
      expect.objectContaining({ code: 'FISCAL_PROVIDER_UNKNOWN' }),
    );
  });

  it('piloto desligado: CNPJ da allowlist não é roteado para LOBONOTAS', () => {
    process.env.LOBONOTAS_CNPJS_MANAUS = '12.345.678/0001-90';
    const resolver = makeResolver();
    expect(resolver.resolveProviderForCnpj('12345678000190')).toBe(plugNotasProvider);
  });

  it('piloto ligado: CNPJ da allowlist vai para LOBONOTAS, fora dela permanece PLUGNOTAS', () => {
    process.env.LOBONOTAS_PILOT_ENABLED = 'true';
    process.env.LOBONOTAS_CNPJS_MANAUS = '12.345.678/0001-90';
    const resolver = makeResolver();
    expect(resolver.resolveProviderForCnpj('12345678000190')).toBe(lobonotasProvider);
    expect(resolver.resolveProviderForCnpj('43521115000134')).toBe(plugNotasProvider);
    expect(resolver.resolveProviderForCnpj(undefined)).toBe(plugNotasProvider);
  });

  it('pollingProviderNames cobre ativo e o provider piloto quando habilitado', () => {
    const resolver = makeResolver();
    expect(resolver.pollingProviderNames()).toEqual([PLUGNOTAS_PROVIDER]);

    process.env.FISCAL_PROVIDER_ACTIVE = LOBONOTAS_PROVIDER;
    expect(resolver.pollingProviderNames()).toEqual([LOBONOTAS_PROVIDER]);

    delete process.env.FISCAL_PROVIDER_ACTIVE;
    process.env.LOBONOTAS_PILOT_ENABLED = 'true';
    expect(resolver.pollingProviderNames()).toEqual(
      expect.arrayContaining([PLUGNOTAS_PROVIDER, LOBONOTAS_PROVIDER]),
    );
  });
});
