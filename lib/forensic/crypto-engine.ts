/**
 * Moteur CRYPTO — « Intégrité cryptographique ».
 *
 * Règles :
 *   clientHash === serverHash        → 100/100 (intégrité du TRANSFERT)
 *   clientHash !== serverHash        → 0/100 + anomalie critique
 *   seconde empreinte indisponible   → statut informatif, score null,
 *                                      poids effectif nul, aucune fausse
 *                                      confirmation
 *   erreur de calcul                 → statut error, score null, poids nul
 *
 * Un 100/100 signifie uniquement que le fichier reçu est identique au fichier
 * sélectionné avant transfert. Il ne prouve rien sur l'authenticité du contenu
 * avant son importation. Le SHA-256 n'est JAMAIS présenté comme une signature
 * numérique, et les mises à jour incrémentales des PDF appartiennent au moteur
 * Structure.
 */

import type { Anomaly, EvidenceItem } from "./types";
import { makeEngineResult, subtest, type EngineResult, type EngineStatus } from "./engine-result";
import type { IntegrityVerification } from "./verify-integrity.functions";
import { isCryptoValid, STRICT_MESSAGES } from "./strict-policy";

export const CRYPTO_MESSAGES = {
  verified: "Intégrité du transfert vérifiée — empreintes identiques",
  mismatch: "Échec d'intégrité — empreintes différentes",
  unavailable: "Empreinte calculée — comparaison non disponible",
  analysisImpossible: STRICT_MESSAGES.cryptoInvalid,
} as const;

export interface CryptoEngineOutput {
  engine: EngineResult;
  anomalies: Anomaly[];
  evidence: EvidenceItem[];
  /** Contrôle bloquant : true seulement si score === 100 et empreintes égales. */
  valid: boolean;
}

export function buildCryptoEngine(v: IntegrityVerification): CryptoEngineOutput {
  const anomalies: Anomaly[] = [];
  const evidence: EvidenceItem[] = [
    { group: "crypto", key: "client_hash", label: "clientHash (avant transfert)", value: v.clientHash },
    { group: "crypto", key: "server_hash", label: "serverHash (après stockage)", value: v.serverHash ?? "non calculé" },
    {
      group: "crypto",
      key: "hash_match",
      label: "Comparaison des empreintes",
      value: v.hashMatch === null ? "non disponible" : v.hashMatch ? "identiques" : "différentes",
    },
  ];

  let status: EngineStatus;
  let score: number | null;
  let summary: string;
  const limitations: string[] = [];

  switch (v.status) {
    case "verified":
      status = "completed";
      score = 100;
      summary = `${CRYPTO_MESSAGES.verified}. Ce résultat couvre uniquement l'intégrité du transfert, pas l'authenticité du contenu avant importation.`;
      break;
    case "mismatch":
      status = "completed";
      score = 0;
      summary = CRYPTO_MESSAGES.mismatch;
      anomalies.push({
        engine: "crypto",
        code: "HASH_MISMATCH",
        label: "Rupture d'intégrité : clientHash ≠ serverHash",
        detail:
          "L'empreinte SHA-256 du fichier stocké diffère de celle calculée avant l'envoi. Le fichier a été altéré ou tronqué pendant le transfert.",
        severity: "critical",
      });
      break;
    case "unavailable":
      status = "informational";
      score = null;
      summary = "Empreinte d'acquisition calculée — vérification après transfert indisponible";
      limitations.push(v.message);
      break;
    default:
      status = "error";
      score = null;
      summary = "Erreur de calcul de l'empreinte — moteur non contributif";
      limitations.push(v.message);
      break;
  }

  // Le contrôle CRYPTO est BLOQUANT et n'entre pas dans le Fusion Score :
  // il conditionne seulement la possibilité de produire un verdict.
  const valid = isCryptoValid({ status, score, clientHash: v.clientHash, serverHash: v.serverHash });

  const engine = makeEngineResult({
    engineId: "crypto",
    status,
    score,
    // Une comparaison d'empreintes est déterministe : fiabilité maximale.
    confidence: score === null ? 0 : 100,
    coverage: score === null ? 0 : 100,
    summary,
    limitations: [
      ...limitations,
      "Le SHA-256 est une empreinte d'intégrité, jamais une signature numérique.",
      "Les mises à jour incrémentales des PDF sont évaluées par le moteur Structure.",
    ],
    technicalDetails: {
      clientHash: v.clientHash,
      serverHash: v.serverHash,
      hashMatch: v.hashMatch,
      bytesHashed: v.bytesHashed,
      errorCode: v.errorCode,
    },
    subtests: [
      subtest("acquisition_hash", "Empreinte d'acquisition (clientHash)", 0.5, "completed",
        "SHA-256 calculé côté client avant le transfert", 100, { clientHash: v.clientHash.slice(0, 24) + "…" }),
      subtest(
        "stored_hash",
        "Recalcul après stockage (serverHash)",
        0.5,
        v.status === "verified" || v.status === "mismatch" ? "completed" : v.status === "unavailable" ? "unavailable" : "error",
        v.serverHash ? `SHA-256 recalculé sur ${v.bytesHashed ?? 0} octets relus depuis le stockage` : v.message,
        v.status === "verified" ? 100 : v.status === "mismatch" ? 0 : null,
      ),
    ],
  });

  engine.technicalDetails.cryptoValid = valid;
  engine.technicalDetails.blocking = true;

  return { engine, anomalies, evidence, valid };
}
