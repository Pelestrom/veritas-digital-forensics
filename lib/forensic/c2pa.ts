/**
 * Adaptateur C2PA / Content Credentials — rattaché au moteur METADATA
 * (« Métadonnées et provenance »), jamais au moteur IA.
 *
 * IMPORTANT : aucune simulation. Ce projet n'embarque pas de validateur
 * C2PA (pas de parseur de manifeste JUMBF, pas de vérification de
 * signature COSE, pas de chaîne de certificats). L'adaptateur se limite
 * donc à :
 *   - `absent`      : aucun conteneur C2PA repéré → aucune information,
 *                     aucune pénalité ;
 *   - `unvalidated` : un conteneur C2PA est présent, mais sa signature et
 *                     son certificat ne peuvent pas être validés ici.
 *
 * Aucun statut « valide » ne peut être retourné sans validateur réel.
 */

import type { Anomaly, EvidenceItem } from "./types";

export type C2paValidationStatus =
  | "absent"
  | "unvalidated"
  | "invalid_signature"
  | "asset_mismatch"
  | "untrusted_certificate"
  | "incomplete"
  | "valid"
  | "unavailable";

export const C2PA_STATUS_LABEL: Record<C2paValidationStatus, string> = {
  absent: "Aucun manifeste C2PA",
  unvalidated: "Manifeste présent — validation indisponible",
  invalid_signature: "Signature du manifeste invalide",
  asset_mismatch: "Le fichier ne correspond plus au manifeste",
  untrusted_certificate: "Certificat du signataire non reconnu",
  incomplete: "Manifeste incomplet",
  valid: "Manifeste valide",
  unavailable: "Validateur C2PA indisponible",
};

export interface C2paResult {
  status: C2paValidationStatus;
  manifestPresent: boolean;
  summary: string;
  anomalies: Anomaly[];
  evidence: EvidenceItem[];
}

/** Recherche d'un conteneur JUMBF/C2PA dans l'en-tête du fichier. */
export async function inspectC2pa(file: File): Promise<C2paResult> {
  try {
    const head = new Uint8Array(await file.slice(0, Math.min(file.size, 2_000_000)).arrayBuffer());
    let text = "";
    const chunk = 32768;
    for (let i = 0; i < head.length; i += chunk) {
      text += String.fromCharCode.apply(null, Array.from(head.subarray(i, i + chunk)) as number[]);
    }
    const present = /jumbf|c2pa|urn:uuid:c2pa|contentcredentials|c2pa\.assertions/i.test(text);

    if (!present) {
      return {
        status: "absent",
        manifestPresent: false,
        summary: "Aucun manifeste C2PA — absence normale, sans pénalité.",
        anomalies: [],
        evidence: [{ group: "identity", key: "c2pa_status", label: "Provenance C2PA", value: C2PA_STATUS_LABEL.absent }],
      };
    }

    return {
      status: "unvalidated",
      manifestPresent: true,
      summary:
        "Un conteneur C2PA est présent. Sa signature, ses assertions et son certificat ne sont pas validés : aucun validateur C2PA n'est embarqué.",
      anomalies: [
        {
          engine: "metadata",
          code: "C2PA_MANIFEST_PRESENT",
          label: "Manifeste C2PA (Content Credentials) présent",
          detail:
            "Le fichier déclare une provenance signée. La validation cryptographique du manifeste n'est pas disponible dans cette version — la présence seule n'est ni un indice favorable, ni une anomalie.",
          severity: "info",
        },
      ],
      evidence: [{ group: "identity", key: "c2pa_status", label: "Provenance C2PA", value: C2PA_STATUS_LABEL.unvalidated }],
    };
  } catch (e) {
    return {
      status: "unavailable",
      manifestPresent: false,
      summary: `Inspection C2PA impossible : ${e instanceof Error ? e.message : "erreur de lecture"}`,
      anomalies: [],
      evidence: [{ group: "identity", key: "c2pa_status", label: "Provenance C2PA", value: C2PA_STATUS_LABEL.unavailable }],
    };
  }
}
