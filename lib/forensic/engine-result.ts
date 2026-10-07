/**
 * Modèle commun de résultat de moteur (V4).
 *
 * Objectifs :
 *  - distinguer score de confiance, risque, couverture, fiabilité ;
 *  - ne JAMAIS produire un score artificiel (50 / 99 / 100) quand un test
 *    n'a pas été exécuté → `score: null` + statut explicite ;
 *  - rester additif : les anciennes analyses (`{value, weight, rationale}`)
 *    restent lisibles via `adaptLegacyEngineScores`.
 */

import { ENGINE_META, resolveEngineId, type EngineId } from "./engines";
import type { EngineScores, ScoreBreakdown } from "./types";

export type EngineStatus =
  | "completed"
  | "informational"
  | "not_applicable"
  | "unavailable"
  | "error";

export const STATUS_LABEL: Record<EngineStatus, string> = {
  completed: "Analysé",
  informational: "Informatif",
  not_applicable: "Non applicable",
  unavailable: "Indisponible",
  error: "Erreur",
};

/** Gravité normalisée d'un sous-test (politique strict-zero-trust-4.0). */
export type SubtestSeverity = "none" | "weak" | "medium" | "high" | "critical";

export interface SubtestResult {
  id: string;
  label: string;
  status: EngineStatus;
  /** 0..100 (conformité) ou null si aucun score fiable. */
  score: number | null;
  /** Poids interne du sous-test dans le moteur (0..1) — informatif uniquement. */
  weight: number;
  summary: string;
  metrics?: Record<string, string | number | null>;
  // ---- Champs additifs de la politique stricte (optionnels : les anciens
  // résultats persistés restent lisibles sans eux).
  severity?: SubtestSeverity;
  /** Preuve déterministe : le score est forcé à 0/100. */
  deterministic?: boolean;
  /** Une anomalie positive a été relevée par ce contrôle. */
  hasAnomaly?: boolean;
  /** Contrôle obligatoire (compte dans la complétude). Défaut : true. */
  required?: boolean;
  /** Contrôle applicable au format. Défaut : true. */
  applicable?: boolean;
  /** Fiabilité de la méthode 0..100. */
  reliability?: number | null;
  /** Confiance de la mesure 0..100. */
  confidence?: number | null;
  /** Codes de preuves rattachées à ce sous-test. */
  evidences?: string[];
}

export interface EngineResult {
  engineId: EngineId;
  label: string;
  fullLabel: string;
  status: EngineStatus;
  /** Confiance 0..100 — null si non calculable. */
  score: number | null;
  /** Risque 0..100 — généralement 100 - score. */
  riskScore: number | null;
  /** Confiance dans la méthode 0..100. */
  confidence: number;
  /** Part des sous-tests prévus réellement exécutés 0..100. */
  coverage: number;
  baseWeight: number;
  effectiveWeight: number;
  normalizedWeight: number;
  contributive: boolean;
  summary: string;
  limitations: string[];
  technicalDetails: Record<string, string | number | boolean | null>;
  subtests: SubtestResult[];
  engineVersion: string;
}

export interface EngineDraft {
  engineId: EngineId;
  status: EngineStatus;
  score?: number | null;
  confidence?: number;
  coverage?: number;
  summary: string;
  limitations?: string[];
  technicalDetails?: Record<string, string | number | boolean | null>;
  subtests?: SubtestResult[];
}

const NON_CONTRIBUTIVE: ReadonlySet<EngineStatus> = new Set([
  "not_applicable",
  "unavailable",
  "error",
]);

/** Construit un EngineResult complet (poids renseignés plus tard par la pondération). */
export function makeEngineResult(draft: EngineDraft): EngineResult {
  const meta = ENGINE_META[draft.engineId];
  const contributive = !NON_CONTRIBUTIVE.has(draft.status) && typeof draft.score === "number";
  const score = typeof draft.score === "number" ? clamp(draft.score) : null;
  return {
    engineId: draft.engineId,
    label: meta.short,
    fullLabel: meta.full,
    status: draft.status,
    score,
    riskScore: score === null ? null : clamp(100 - score),
    confidence: clamp(draft.confidence ?? (contributive ? 70 : 0)),
    coverage: clamp(draft.coverage ?? coverageFromSubtests(draft.subtests ?? [])),
    baseWeight: 0,
    effectiveWeight: 0,
    normalizedWeight: 0,
    contributive,
    summary: draft.summary,
    limitations: draft.limitations ?? [],
    technicalDetails: draft.technicalDetails ?? {},
    subtests: draft.subtests ?? [],
    engineVersion: meta.version,
  };
}

export function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Couverture = somme des poids des sous-tests exécutés / somme des poids applicables. */
export function coverageFromSubtests(subtests: SubtestResult[]): number {
  if (subtests.length === 0) return 0;
  const applicable = subtests.filter((s) => s.status !== "not_applicable");
  if (applicable.length === 0) return 0;
  const total = applicable.reduce((a, s) => a + s.weight, 0);
  const done = applicable
    .filter((s) => s.status === "completed" || s.status === "informational")
    .reduce((a, s) => a + s.weight, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/**
 * Agrège les sous-tests scorés en un score de moteur, avec renormalisation
 * des sous-poids lorsque certains sous-tests sont indisponibles.
 */
export function aggregateSubtests(subtests: SubtestResult[]): { score: number | null; usedWeight: number } {
  let weighted = 0;
  let total = 0;
  for (const s of subtests) {
    if (s.status !== "completed") continue;
    if (typeof s.score !== "number") continue;
    weighted += s.score * s.weight;
    total += s.weight;
  }
  if (total <= 0) return { score: null, usedWeight: 0 };
  return { score: clamp(weighted / total), usedWeight: total };
}

export function subtest(
  id: string,
  label: string,
  weight: number,
  status: EngineStatus,
  summary: string,
  score: number | null = null,
  metrics?: Record<string, string | number | null>,
): SubtestResult {
  return { id, label, weight, status, summary, score, metrics };
}

/**
 * Compatibilité ascendante : reconstruit des EngineResult lisibles à partir
 * des anciennes structures `scores` ({ metadata|ela|structure|crypto|ai }).
 * Les anciens résultats `ela` sont rattachés au moteur Structure.
 */
export function adaptLegacyEngineScores(scores: EngineScores | null | undefined): EngineResult[] {
  if (!scores) return [];
  const buckets = new Map<EngineId, { values: number[]; rationales: string[]; weight: number; legacy: string[] }>();
  for (const [rawKey, raw] of Object.entries(scores)) {
    if (rawKey === "fusion" || !raw) continue;
    const id = resolveEngineId(rawKey);
    if (!id) continue;
    const s = raw as ScoreBreakdown;
    if (typeof s.value !== "number") continue;
    const b = buckets.get(id) ?? { values: [], rationales: [], weight: 0, legacy: [] };
    b.values.push(s.value);
    if (s.rationale) b.rationales.push(s.rationale);
    b.weight += s.weight ?? 0;
    b.legacy.push(rawKey);
    buckets.set(id, b);
  }
  return Array.from(buckets.entries()).map(([id, b]) => {
    const avg = b.values.reduce((a, v) => a + v, 0) / b.values.length;
    const result = makeEngineResult({
      engineId: id,
      status: "completed",
      score: avg,
      confidence: 50,
      coverage: 50,
      summary: b.rationales.join(" · ") || "Résultat issu d'une version antérieure de l'analyse.",
      limitations: ["Ancienne version de l'analyse — modèle de résultat V1 adapté à la lecture."],
      technicalDetails: { legacy_keys: b.legacy.join(", ") },
    });
    result.baseWeight = Math.round(b.weight * 100);
    result.effectiveWeight = result.baseWeight;
    return result;
  });
}
