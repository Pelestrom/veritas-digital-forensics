/**
 * Crypto / integrity engine (client-side).
 *
 * For PDFs, scans raw bytes for signature dictionaries (/Sig, /ByteRange,
 * /AcroForm) and incremental-update markers (multiple %%EOF). For any file,
 * exposes the SHA-256 chain of custody as the baseline evidence.
 *
 * This module deliberately does NOT verify X.509 chains (that requires a
 * server-side trust store); it only reports the presence/absence of a
 * cryptographic signature and obvious tamper indicators.
 */

import type { Anomaly, EvidenceItem } from "./types";

export interface CryptoResult {
  evidence: EvidenceItem[];
  anomalies: Anomaly[];
  score: number;
  rationale: string;
  /** True iff the file declares an embedded signature dictionary. */
  hasSignature: boolean;
}

const enc = new TextDecoder("latin1");

function indexAll(haystack: string, needle: string): number[] {
  const out: number[] = [];
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = haystack.indexOf(needle, i + needle.length);
  }
  return out;
}

export async function analyzePdfCrypto(file: File): Promise<CryptoResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const text = enc.decode(buf);

  const evidence: EvidenceItem[] = [];
  const anomalies: Anomaly[] = [];

  const eofCount = indexAll(text, "%%EOF").length;
  const hasSig = /\/Type\s*\/Sig\b/.test(text) || /\/ByteRange\s*\[/.test(text);
  const hasAcroForm = /\/AcroForm\b/.test(text);
  const byteRangeMatch = text.match(/\/ByteRange\s*\[([^\]]+)\]/);

  evidence.push(
    { group: "crypto", key: "pdf_eof_count", label: "Marqueurs %%EOF", value: eofCount },
    { group: "crypto", key: "pdf_has_signature", label: "Signature embarquée", value: hasSig ? "oui" : "non" },
    { group: "crypto", key: "pdf_has_acroform", label: "AcroForm présent", value: hasAcroForm ? "oui" : "non" },
  );

  if (byteRangeMatch) {
    evidence.push({ group: "crypto", key: "pdf_byterange", label: "ByteRange", value: byteRangeMatch[1].trim() });
  }

  let score = 80;
  let rationale = "PDF non signé — intégrité reposant uniquement sur l'empreinte SHA-256";

  if (hasSig) {
    score = 95;
    rationale = "Signature numérique détectée (présence du dictionnaire /Sig + /ByteRange)";
    anomalies.push({
      code: "PDF_SIGNATURE_PRESENT",
      label: "Signature numérique embarquée",
      detail: "La vérification cryptographique de la chaîne X.509 nécessite un service de validation dédié.",
      severity: "info",
      engine: "crypto",
    });
  }

  if (eofCount > 1) {
    score = Math.min(score, 55);
    anomalies.push({
      code: "PDF_MULTIPLE_EOF",
      label: `${eofCount} marqueurs %%EOF — modifications incrémentales`,
      detail: "Le document a été ré-enregistré au moins " + (eofCount - 1) + " fois après sa signature initiale.",
      severity: hasSig ? "high" : "medium",
      engine: "crypto",
    });
  }

  return { evidence, anomalies, score, rationale, hasSignature: hasSig };
}
