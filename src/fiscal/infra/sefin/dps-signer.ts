import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

export const DSIG_NAMESPACE = 'http://www.w3.org/2000/09/xmldsig#';
export const DSIG_C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
export const DSIG_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
export const DSIG_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
export const DSIG_RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

export interface DpsCertMaterial {
  pfxBase64: string;
  password: string;
}

export interface DpsCertMaterialPem {
  privateKeyPem: string;
  certificatePem: string;
}

export function extractKeyAndCert(material: DpsCertMaterial): DpsCertMaterialPem {
  const binary = Buffer.from(material.pfxBase64, 'base64').toString('binary');
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(binary));
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, material.password);

  const keyOids = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag];
  let privateKey: forge.pki.PrivateKey | undefined;
  for (const oid of keyOids) {
    const bags = pkcs12.getBags({ bagType: oid })[oid] ?? [];
    const bag = bags.find((candidate) => Boolean(candidate.key));
    if (bag?.key) {
      privateKey = bag.key as forge.pki.PrivateKey;
      break;
    }
  }
  if (!privateKey) {
    throw new Error('certificado PFX não contém chave privada utilizável');
  }

  const certBags =
    pkcs12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certificateBag = certBags.find((bag) => Boolean(bag.cert));
  if (!certificateBag?.cert) {
    throw new Error('certificado PFX não contém certificado');
  }

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certificatePem = forge.pki.certificateToPem(certificateBag.cert);
  return { privateKeyPem, certificatePem };
}

export function extractDpsId(dpsXml: string): string {
  const match = /<infDPS\s+Id="([^"]+)"/.exec(dpsXml);
  if (!match) {
    throw new Error('DPS XML não contém infDPS/@Id');
  }
  return match[1];
}

export function signXmlElement(input: {
  xml: string;
  id: string;
  localName: string;
  keyAndCert: DpsCertMaterialPem;
}): string {
  const signedXml = new SignedXml({
    privateKey: input.keyAndCert.privateKeyPem,
    publicCert: input.keyAndCert.certificatePem,
    canonicalizationAlgorithm: DSIG_C14N,
    signatureAlgorithm: DSIG_RSA_SHA256,
    getKeyInfoContent: SignedXml.getKeyInfoContent,
  });

  signedXml.addReference({
    xpath: `//*[local-name()='${input.localName}']`,
    transforms: [DSIG_ENVELOPED, DSIG_C14N],
    digestAlgorithm: DSIG_SHA256,
    uri: `#${input.id}`,
  });

  signedXml.computeSignature(input.xml, {
    location: { reference: '/*', action: 'append' },
    prefix: 'ds',
  });

  return signedXml.getSignedXml();
}

export function signDps(dpsXml: string, keyAndCert: DpsCertMaterialPem): string {
  return signXmlElement({
    xml: dpsXml,
    id: extractDpsId(dpsXml),
    localName: 'infDPS',
    keyAndCert,
  });
}
