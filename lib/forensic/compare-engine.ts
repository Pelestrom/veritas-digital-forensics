/**
 * Moteur de comparaison référence ↔ candidat (client-side).
 * Compare hash, taille, MIME, métadonnées extraites et calcule un
 * Reference Similarity Score 0..100.
 */

import type { MetadataResult } from "./metadata";

export interface DiffEntry {
  key: string;
  reference: string | null;
  candidate: string | null;
  status: "match" | "diff" | "missing";
}

export interface CompareResult {
  similarityScore: number;
  verdict: "match" | "near_match" | "altered" | "different";
  diff: DiffEntry[];
  rationale: string;
}

interface Side {
  filename: string;
  sha256: string;
  size: number;
  mime: string;
  meta: MetadataResult | null;
}

function metaMap(m: MetadataResult | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!m) return out;
  for (const e of m.evidence) {
    if (e.value == null) continue;
    out.set(e.key, String(e.value));
  }
  return out;
}

export function compareReferences(reference: Side, candidate: Side): CompareResult {
  const diff: DiffEntry[] = [];

  // Hash identique → bit-à-bit
  if (reference.sha256 === candidate.sha256) {
    diff.push({ key: "sha256", reference: reference.sha256, candidate: candidate.sha256, status: "match" });
    return {
      similarityScore: 100,
      verdict: "match",
      diff,
      rationale: "Hashes SHA-256 identiques — le candidat est bit-à-bit la référence.",
    };
  }
  diff.push({ key: "sha256", reference: reference.sha256, candidate: candidate.sha256, status: "diff" });

  // MIME / taille
  diff.push({
    key: "mime",
    reference: reference.mime,
    candidate: candidate.mime,
    status: reference.mime === candidate.mime ? "match" : "diff",
  });
  diff.push({
    key: "size",
    reference: String(reference.size),
    candidate: String(candidate.size),
    status: reference.size === candidate.size ? "match" : "diff",
  });

  // Métadonnées
  const refMeta = metaMap(reference.meta);
  const canMeta = metaMap(candidate.meta);
  const allKeys = new Set<string>([...refMeta.keys(), ...canMeta.keys()]);
  let matched = 0; let total = 0; let critical = 0;
  const CRITICAL_KEYS = ["Producer", "Creator", "Author", "Title", "Make", "Model", "Software", "DateTimeOriginal", "CreateDate", "ModifyDate"];
  for (const key of allKeys) {
    const r = refMeta.get(key) ?? null;
    const c = canMeta.get(key) ?? null;
    total++;
    if (r && c && r === c) matched++;
    const status: DiffEntry["status"] = r && c ? (r === c ? "match" : "diff") : "missing";
    if (status === "diff" && CRITICAL_KEYS.includes(key)) critical++;
    diff.push({ key, reference: r, candidate: c, status });
  }

  // Scoring
  const metaRatio = total === 0 ? 0.5 : matched / total;
  const sizeDelta = Math.abs(reference.size - candidate.size) / Math.max(reference.size, 1);
  const sizePenalty = Math.min(0.3, sizeDelta);
  const mimePenalty = reference.mime === candidate.mime ? 0 : 0.2;
  const criticalPenalty = Math.min(0.4, critical * 0.08);

  const raw = metaRatio - sizePenalty - mimePenalty - criticalPenalty;
  const similarityScore = Math.max(0, Math.min(100, Math.round(raw * 100)));

  let verdict: CompareResult["verdict"];
  if (similarityScore >= 90) verdict = "near_match";
  else if (similarityScore >= 60) verdict = "altered";
  else verdict = "different";

  const reasonBits: string[] = [];
  reasonBits.push(`${matched}/${total} clés métadonnées identiques`);
  if (sizeDelta > 0.01) reasonBits.push(`écart taille ${(sizeDelta * 100).toFixed(1)} %`);
  if (mimePenalty) reasonBits.push("MIME différent");
  if (critical > 0) reasonBits.push(`${critical} clé(s) critiques modifiées`);

  return {
    similarityScore,
    verdict,
    diff: diff.slice(0, 80),
    rationale: reasonBits.join(" · "),
  };
}
