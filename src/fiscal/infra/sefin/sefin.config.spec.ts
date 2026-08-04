import { getSefinConfig } from './sefin.config';

describe('sefin.config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SEFIN_ENABLED;
    delete process.env.SEFIN_BASE_URL;
    delete process.env.SEFIN_ADN_BASE_URL;
    delete process.env.SEFIN_ENV;
    delete process.env.SEFIN_TP_AMB;
    delete process.env.SEFIN_HTTP_TIMEOUT_MS;
    delete process.env.SEFIN_HTTP_MAX_ATTEMPTS;
    delete process.env.SEFIN_HTTP_BASE_DELAY_MS;
    delete process.env.SEFIN_HTTP_MAX_DELAY_MS;
    delete process.env.SEFIN_VER_APLIC;
    delete process.env.NFSE_VER_APLIC;
    delete process.env.SEFIN_DPS_SERIE;
    delete process.env.SEFIN_CMUN_IBGE;
    delete process.env.NFSE_CMUN_IBGE;
    delete process.env.SEFIN_CODIGO_TRIBUTACAO_NACIONAL;
    delete process.env.SEFIN_VERIFY_CERT;
    delete process.env.SEFIN_NFSE_ENVELOPE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults: desabilitado, produção restrita, tpAmb 2, timeout 30s, json', () => {
    const cfg = getSefinConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.environment).toBe('producaorestrita');
    expect(cfg.baseUrl).toBe('https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional');
    expect(cfg.adnBaseUrl).toBe('https://adn.producaorestrita.nfse.gov.br');
    expect(cfg.tpAmb).toBe('2');
    expect(cfg.timeoutMs).toBe(30000);
    expect(cfg.maxAttempts).toBe(3);
    expect(cfg.verAplic).toBe('ZERA-1.0');
    expect(cfg.dpsSerie).toBe('1');
    expect(cfg.cLocEmi).toBe('1302603');
    expect(cfg.verifyCert).toBe(true);
    expect(cfg.nfseEnvelope).toBe('json');
  });

  it('produção real: tpAmb 1 e verAplic do NFSE_VER_APLIC', () => {
    process.env.SEFIN_BASE_URL = 'https://sefin.nfse.gov.br/SefinNacional';
    process.env.NFSE_VER_APLIC = 'ZERA-2.0';
    const cfg = getSefinConfig();
    expect(cfg.environment).toBe('producao');
    expect(cfg.tpAmb).toBe('1');
    expect(cfg.verAplic).toBe('ZERA-2.0');
  });

  it('override de tpAmb e cLocEmi a partir de env', () => {
    process.env.SEFIN_TP_AMB = '1';
    process.env.SEFIN_CMUN_IBGE = '3550308';
    process.env.SEFIN_DPS_SERIE = '42';
    const cfg = getSefinConfig();
    expect(cfg.tpAmb).toBe('1');
    expect(cfg.cLocEmi).toBe('3550308');
    expect(cfg.dpsSerie).toBe('42');
  });

  it('cLocEmi sanitiza não-dígitos', () => {
    process.env.SEFIN_CMUN_IBGE = '13.026.03';
    expect(getSefinConfig().cLocEmi).toBe('1302603');
  });

  it('permite override de envelope xml e verifyCert off', () => {
    process.env.SEFIN_NFSE_ENVELOPE = 'xml';
    process.env.SEFIN_VERIFY_CERT = 'false';
    const cfg = getSefinConfig();
    expect(cfg.nfseEnvelope).toBe('xml');
    expect(cfg.verifyCert).toBe(false);
  });

  it('codigoTributacaoNacional vazio vira undefined', () => {
    process.env.SEFIN_CODIGO_TRIBUTACAO_NACIONAL = '   ';
    expect(getSefinConfig().codigoTributacaoNacional).toBeUndefined();
  });
});
