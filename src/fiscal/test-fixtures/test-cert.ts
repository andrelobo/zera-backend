import * as forge from 'node-forge';

import { extractKeyAndCert } from '../infra/sefin/dps-signer';

export const TEST_CERT_PASSWORD = 'zera-sefin';

export interface TestCertPfx {
  pfxBase64: string;
  password: string;
}

export interface TestCertPem {
  privateKeyPem: string;
  certificatePem: string;
}

export interface TestPki {
  caPem: string;
  serverKeyPem: string;
  serverCertPem: string;
  clientPfx: TestCertPfx;
}

function toPfx(key: forge.pki.rsa.PrivateKey, cert: forge.pki.Certificate): TestCertPfx {
  const asn1 = forge.pkcs12.toPkcs12Asn1(key, cert, TEST_CERT_PASSWORD, {
    algorithm: '3des',
  });
  const der = forge.asn1.toDer(asn1).getBytes();
  return { pfxBase64: Buffer.from(der, 'binary').toString('base64'), password: TEST_CERT_PASSWORD };
}

function generateSelfSigned(
  commonName: string,
  serialNumber: string,
): {
  key: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
} {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serialNumber;
  cert.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [{ name: 'commonName', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { key: keys.privateKey, cert };
}

function issueCert(input: {
  signerKey: forge.pki.rsa.PrivateKey;
  signerCert: forge.pki.Certificate;
  commonName: string;
  serialNumber: string;
  subjectAltNames?: Array<{ type: number; value?: string; ip?: string }>;
}): { key: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = input.serialNumber;
  cert.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  cert.setSubject([{ name: 'commonName', value: input.commonName }]);
  cert.setIssuer(input.signerCert.subject.attributes);
  const extensions: any[] = [{ name: 'basicConstraints', cA: false }];
  if (input.subjectAltNames) {
    extensions.push({ name: 'subjectAltName', altNames: input.subjectAltNames });
  }
  cert.setExtensions(extensions);
  cert.sign(input.signerKey, forge.md.sha256.create());
  return { key: keys.privateKey, cert };
}

/** Certificado A1 autoassinado de teste (mesmo shape de sefin.provider.spec). */
export function createTestCert(): TestCertPfx {
  const { key, cert } = generateSelfSigned('ZERA SEFIN TESTE', '01');
  return toPfx(key, cert);
}

/** Converte o PFX de teste em key/cert PEM (mesma funcao usada em producao). */
export function toPem(material: TestCertPfx): TestCertPem {
  return extractKeyAndCert(material);
}

/** PKI completa para um servidor HTTPS mTLS local: CA + cert do servidor + PFX do cliente assinado pela CA. */
export function createTestPki(): TestPki {
  const caKeys = forge.pki.rsa.generateKeyPair(2048);
  const caCert = forge.pki.createCertificate();
  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = '02';
  caCert.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  caCert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const caAttrs = [{ name: 'commonName', value: 'ZERA TEST CA' }];
  caCert.setSubject(caAttrs);
  caCert.setIssuer(caAttrs);
  caCert.setExtensions([{ name: 'basicConstraints', cA: true }]);
  caCert.sign(caKeys.privateKey, forge.md.sha256.create());

  const server = issueCert({
    signerKey: caKeys.privateKey,
    signerCert: caCert,
    commonName: 'sefin.localhost',
    serialNumber: '03',
    subjectAltNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
    ],
  });
  const client = issueCert({
    signerKey: caKeys.privateKey,
    signerCert: caCert,
    commonName: 'ZERA SEFIN TESTE',
    serialNumber: '04',
  });

  return {
    caPem: forge.pki.certificateToPem(caCert),
    serverKeyPem: forge.pki.privateKeyToPem(server.key),
    serverCertPem: forge.pki.certificateToPem(server.cert),
    clientPfx: toPfx(client.key, client.cert),
  };
}
