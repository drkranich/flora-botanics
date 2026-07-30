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
  // Limpa a string base64: remove prefixo data URL e espaços/quebras que corrompem o decode
  const cleanBase64 = pfxBase64
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/[\s\r\n\t]/g, "");

  const pfxBytes = forge.util.decode64(cleanBase64);

  // { strict: false, parseAllBytes: false } — ignora bytes residuais no DER
  // (node-forge v1.3+ mantém parseAllBytes: true por padrão mesmo com strict: false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pfxAsn1 = forge.asn1.fromDer(pfxBytes, { strict: false, parseAllBytes: false } as unknown as any);

  // strict: false — não falha se a verificação MAC do PFX divergir
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, pfxPassword);

  // 2. Extrai chave privada (tenta pkcs8ShroudedKeyBag e keyBag)
  const shroudedBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBags2     = pfx.getBags({ bagType: forge.pki.oids.keyBag });
  const keyBag =
    (shroudedBags[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])[0] ??
    (keyBags2[forge.pki.oids.keyBag] ?? [])[0];
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
