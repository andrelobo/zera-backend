import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

import { buildDps, buildDpsId, DpsBuilderOptions } from './dps-builder';
import {
  DSIG_C14N,
  DSIG_ENVELOPED,
  DSIG_NAMESPACE,
  DSIG_RSA_SHA256,
  DSIG_SHA256,
  extractDpsId,
  extractKeyAndCert,
  signDps,
} from './dps-signer';

function createTestCert(): { pfxBase64: string; password: string; certificatePem: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [{ name: 'commonName', value: 'ZERA TESTE' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, 'zera-test', {
    algorithm: '3des',
  });
  const der = forge.asn1.toDer(asn1).getBytes();
  const pfxBase64 = Buffer.from(der, 'binary').toString('base64');
  return { pfxBase64, password: 'zera-test', certificatePem: forge.pki.certificateToPem(cert) };
}

const baseInput = {
  prestador: {
    cnpj: '43521115000134',
    inscricaoMunicipal: '51754301',
    razaoSocial: 'BURGUS LTDA',
    regimeTributarioSn: { opSimpNac: 3, regApTribSN: 1, regEspTrib: 0 },
  },
  tomador: {
    cpfCnpj: '61020788100',
    razaoSocial: 'ANDRE AUGUSTO DE HOLANDA LOBO',
  },
  servico: {
    codigoNacional: '171901',
    codigoTributacao: '100',
    descricao: 'Consulta IR 2024',
    valor: 150,
    iss: { retido: false, aliquota: 5 },
    tributacaoTotal: { pTotTribSN: 6 },
  },
} as const;

const options: DpsBuilderOptions = {
  serie: '1',
  nDPS: '1',
  cLocEmi: '1302603',
};

function extractSignatureElement(signedXml: string): string {
  const match = /<Signature[^>]*>[\s\S]*<\/Signature>/.exec(signedXml);
  if (!match) throw new Error('Signature element not found');
  return match[0];
}

describe('dps-signer', () => {
  const cert = createTestCert();
  const material = { pfxBase64: cert.pfxBase64, password: cert.password };

  it('extracts private key and certificate from a password-protected PFX', () => {
    const extracted = extractKeyAndCert(material);
    expect(extracted.privateKeyPem).toContain('-----BEGIN RSA PRIVATE KEY-----');
    expect(extracted.certificatePem).toContain('BEGIN CERTIFICATE');
  });

  it('signs a DPS XML enveloped with rsa-sha256 and inclusive c14n', () => {
    const dpsXml = buildDps(baseInput as any, options);
    const id = buildDpsId({
      cLocEmi: '1302603',
      cnpjPrestador: '43521115000134',
      serie: '1',
      nDPS: '1',
    });
    expect(extractDpsId(dpsXml)).toBe(id);

    const signed = signDps(dpsXml, extractKeyAndCert(material));

    expect(signed).toContain(`Id="${id}"`);
    expect(signed).toContain(`<Signature xmlns="${DSIG_NAMESPACE}">`);
    expect(signed).toContain(`<CanonicalizationMethod Algorithm="${DSIG_C14N}"/>`);
    expect(signed).toContain(`<SignatureMethod Algorithm="${DSIG_RSA_SHA256}"/>`);
    expect(signed).toContain(`<DigestMethod Algorithm="${DSIG_SHA256}"/>`);
    expect(signed).toContain(`<Transform Algorithm="${DSIG_ENVELOPED}"/>`);
    expect(signed).toContain(`<Reference URI="#${id}">`);
    expect(signed).toContain('<KeyInfo><X509Data><X509Certificate>');
    expect(signed.indexOf('<Signature')).toBeGreaterThan(signed.indexOf('</infDPS>'));
    expect(signed).not.toContain('xmlns:ds');
    expect(signed).not.toMatch(/<ds:/);
  });

  it('produces a cryptographically valid signature (checkSignature true)', () => {
    const dpsXml = buildDps(baseInput as any, options);
    const signed = signDps(dpsXml, extractKeyAndCert(material));

    const verifier = new SignedXml({ publicCert: cert.certificatePem });
    verifier.loadSignature(extractSignatureElement(signed));
    expect(verifier.checkSignature(signed)).toBe(true);
  });

  it('fails signature verification when the DPS content is tampered', () => {
    const dpsXml = buildDps(baseInput as any, options);
    const signed = signDps(dpsXml, extractKeyAndCert(material));
    const tampered = signed.replace('<vServ>150.00</vServ>', '<vServ>150.01</vServ>');

    const verifier = new SignedXml({ publicCert: cert.certificatePem });
    verifier.loadSignature(extractSignatureElement(tampered));
    expect(verifier.checkSignature(tampered)).toBe(false);
  });
});
