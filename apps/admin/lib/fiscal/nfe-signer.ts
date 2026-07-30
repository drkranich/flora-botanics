/**
 * Assinatura XMLDSig para NF-e 4.00
 *
 * Algoritmos (conforme NT 2022.001.a):
 *   DigestMethod:    SHA-256
 *   SignatureMethod: RSA-SHA-256 (PKCS#1 v1.5)
 *   C14N Transform:  http://www.w3.org/TR/2001/REC-xml-c14n-20010315
 *
 * Fluxo:
 *   1. Parse do PFX via node-forge
 *   2. SHA-256 do infNFe canonical → DigestValue
 *   3. Monta SignedInfo (já em forma canônica)
 *   4. RSA-SHA256 do SignedInfo → SignatureValue
 *   5. Extrai cert X.509 do PFX → X509Certificate
 *   6. Retorna <NFe>...<Signature>...</Signature></NFe>
 */

// node-forge: pure-JS, sem código nativo — funciona em CF Workers
import * as forge from "node-forge";

export async function signNFe(
  canonicalInfNFe: string,
  chNFe: string,
  pfxBase64: string,
  pfxPassword: string
): Promise<string> {
  // 1. Parse PFX
  const pfxBytes = forge.util.decode64(pfxBase64);
  const pfxAsn1  = forge.asn1.fromDer(pfxBytes, false);
  const pfx      = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, true, pfxPassword);

  // 2. Extrai chave privada
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag  = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no certificado A1.");
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey;

  // 3. Extrai certificado X.509 e serializa em DER→base64
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag  = (certBags[forge.pki.oids.certBag] ?? [])[0];
  if (!certBag?.cert) throw new Error("Certificado X.509 não encontrado no PFX.");
  const certDer    = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes();
  const x509Base64 = forge.util.encode64(certDer);

  // 4. DigestValue = SHA-256( canonical infNFe )
  const mdDigest   = forge.md.sha256.create();
  mdDigest.update(canonicalInfNFe, "utf8");
  const digestValue = forge.util.encode64(mdDigest.digest().getBytes());

  // 5. Monta SignedInfo em forma canônica
  //    (namespace herdado por todos os filhos; elementos vazios como <tag></tag>)
  const refUri = `#NFe${chNFe}`;
  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>` +
    `<Reference URI="${refUri}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  // 6. SignatureValue = RSA-SHA256( canonical SignedInfo )
  const mdSign = forge.md.sha256.create();
  mdSign.update(signedInfo, "utf8");
  const signatureValue = forge.util.encode64(privateKey.sign(mdSign));

  // 7. Monta elemento <Signature>
  const signatureEl =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${x509Base64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  // 8. Monta <NFe> com infNFe + Signature
  return (
    `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
    canonicalInfNFe +
    signatureEl +
    `</NFe>`
  );
}
