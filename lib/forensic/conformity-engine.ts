/**
 * MOTEUR DE CONFORMITÉ À UNE RÉFÉRENCE (pur, testable).
 *
 * Principe : Zero Trust adapté — vérifier chaque caractéristique pertinente,
 * PAS exiger que deux documents différents soient identiques.
 * Les champs variables (nom, photo, numéro, dates, notes) ne sont JAMAIS
 * comparés par égalité : seuls leur emplacement, format, syntaxe, police et
 * alignement sont contrôlés.
 *
 * Aucun sous-test non exécuté ne reçoit de score : statut explicite + null.
 * Une ressemblance avec une référence ne démontre PAS l'authenticité légale.
 */

import type { EngineStatus } from "./engine-result";
import type { Severity } from "./strict-policy";
import {
  familyOf,
  fontOverlap,
  gridDistance,
  gridHotspots,
  looksVariable,
  normalizeText,
  type StructuralFingerprint,
  type Template,
} from "./reference-fingerprint";
import { verifyMrz } from "./mrz";

export const CONFORMITY_POLICY_VERSION = "reference-conformity-1.0";

export type ConformityVerdict =
  | "CONFORMING"
  | "PROBABLY_CONFORMING"
  | "DEVIATIONS_TO_VERIFY"
  | "NON_CONFORMING"
  | "INCONCLUSIVE"
  | "IMPOSSIBLE";

export const CONFORMITY_VERDICT_LABEL: Record<ConformityVerdict, string> = {
  CONFORMING: "Conforme à la référence",
  PROBABLY_CONFORMING: "Conformité probable",
  DEVIATIONS_TO_VERIFY: "Écarts à vérifier",
  NON_CONFORMING: "Non conforme à la référence",
  INCONCLUSIVE: "Analyse inconcluante",
  IMPOSSIBLE: "Analyse impossible",
};

export const CONFORMITY_MESSAGES = {
  incompatible:
    "Les documents sélectionnés ne semblent pas appartenir au même modèle. Le résultat ne permettrait pas une évaluation fiable.",
  conforming:
    "Aucun écart significatif avec le modèle de référence n'a été détecté dans les éléments contrôlés. Cela ne signifie pas que le document est officiellement authentique.",
  nonConforming:
    "Le document présente des écarts techniques significatifs par rapport à la référence sélectionnée.",
  binaryIdentical: "Le document examiné est une copie binaire exacte de la référence.",
  legal:
    "Une ressemblance avec une référence ne prouve pas l'authenticité juridique d'un document. Une référence incorrecte, falsifiée ou issue d'une autre version du modèle peut produire une conclusion erronée.",
  physical:
    "Les sécurités physiques (hologrammes, réactions ultraviolet et infrarouge, papier, encres) ne sont pas observables dans un fichier : elles n'ont pas été contrôlées.",
} as const;

export interface AxisFinding {
  code: string;
  label: string;
  severity: Severity;
  /** Preuve déterminante : suffit à conclure à une non-conformité. */
  determinant: boolean;
  detail: string;
  /** Localisation normalisée si l'anomalie est positionnée. */
  location?: { x: number; y: number; w?: number; h?: number; page?: number } | null;
}

export interface AxisResult {
  id: string;
  label: string;
  status: EngineStatus;
  /** 0..100 — uniquement si status === "completed". */
  score: number | null;
  weight: number;
  summary: string;
  findings: AxisFinding[];
  limitations: string[];
}

export interface CompatibilityCheckItem {
  field: string;
  reference: string | null;
  target: string | null;
  ok: boolean | null;
}

export interface CompatibilityResult {
  status: "compatible" | "partial" | "incompatible" | "unknown";
  items: CompatibilityCheckItem[];
  message: string;
}

export interface ConformityInput {
  template: Template;
  target: StructuralFingerprint;
  /** Empreinte de la référence la plus proche (mono-exemplaire = la seule). */
  reference: StructuralFingerprint;
  referenceDescriptor?: {
    documentType?: string | null;
    issuer?: string | null;
    country?: string | null;
    templateVersion?: string | null
  };
  targetDescriptor?: { documentType?: string | null };
  /** Intégrité de l'acquisition du document examiné. */
  integrity: { clientHash: string | null; serverHash: string | null; verified: boolean | null };
  /** Le fichier examiné a-t-il pu être ouvert et analysé ? */
  targetReadable: boolean;
  /** La référence est-elle toujours accessible et son SHA-256 inchangé ? */
  referenceAvailable: boolean;
  referenceSha256?: string | null;
  targetSha256?: string | null;
  /** Poursuite exceptionnelle malgré une incompatibilité → INCONCLUANT. */
  exploratory?: boolean;
}

export interface ConformityOutcome {
  verdict: ConformityVerdict;
  rule: string;
  /** Score de conformité 0..100 — null si non calculable. */
  conformityScore: number | null;
  coverage: number;
  reliability: number;
  compatibility: CompatibilityResult;
  axes: AxisResult[];
  determinantFindings: AxisFinding[];
  hotspots: Array<{ x: number; y: number; delta: number }>;
  gridSize: number | null;
  limitations: string[];
  binaryIdentical: boolean;
  policyVersion: string;
  fingerprintVersion: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ------------------------------------------------------- contrôle de compatibilité

export function checkCompatibility(input: ConformityInput): CompatibilityResult {
  const { template, target, referenceDescriptor, targetDescriptor } = input;
  const items: CompatibilityCheckItem[] = [];
  const push = (field: string, ref: string | null, tgt: string | null, ok: boolean | null) =>
    items.push({ field, reference: ref, target: tgt, ok });

  push("format", template.format, target.format, template.format === target.format);
  push(
    "orientation",
    template.orientation,
    target.orientation,
    template.orientation && target.orientation ? template.orientation === target.orientation : null,
  );
  const refRatio = template.ratio;
  const tgtRatio = target.ratio;
  const ratioOk =
    refRatio && tgtRatio ? Math.abs(refRatio - tgtRatio) / refRatio <= 0.06 : null;
  push("proportions", refRatio ? refRatio.toFixed(3) : null, tgtRatio ? tgtRatio.toFixed(3) : null, ratioOk);
  const pagesOk =
    template.pageCount != null && target.pageCount != null ? template.pageCount === target.pageCount : null;
  push("pages", template.pageCount?.toString() ?? null, target.pageCount?.toString() ?? null, pagesOk);
  if (referenceDescriptor?.documentType || targetDescriptor?.documentType) {
    const a = referenceDescriptor?.documentType ?? null;
    const b = targetDescriptor?.documentType ?? null;
    push("type_document", a, b, a && b ? normalizeText(a) === normalizeText(b) : null);
  }
  if (referenceDescriptor?.issuer) push("institution", referenceDescriptor.issuer, null, null);
  if (referenceDescriptor?.country) push("pays", referenceDescriptor.country, null, null);
  if (referenceDescriptor?.templateVersion) push("version_modele", referenceDescriptor.templateVersion, null, null);

  const failed = items.filter((i) => i.ok === false);
  const hardFail = failed.some((i) => i.field === "format" || i.field === "orientation" || i.field === "type_document");
  let status: CompatibilityResult["status"];
  if (hardFail || failed.length >= 3) status = "incompatible";
  else if (failed.length > 0) status = "partial";
  else if (items.every((i) => i.ok === null)) status = "unknown";
  else status = "compatible";

  return {
    status,
    items,
    message:
      status === "incompatible"
        ? CONFORMITY_MESSAGES.incompatible
        : status === "partial"
          ? "Compatibilité partielle : certains attributs du modèle diffèrent, le résultat doit être interprété avec prudence."
          : status === "unknown"
            ? "Compatibilité non démontrable avec les informations disponibles."
            : "La référence et le document examiné semblent appartenir au même modèle.",
  };
}

// ----------------------------------------------------------------- axes

function axis(
  id: string,
  label: string,
  weight: number,
  status: EngineStatus,
  summary: string,
  score: number | null = null,
  findings: AxisFinding[] = [],
  limitations: string[] = [],
): AxisResult {
  return { id, label, weight, status, summary, score: status === "completed" ? score : null, findings, limitations };
}

function axisCompatibility(compat: CompatibilityResult): AxisResult {
  const decided = compat.items.filter((i) => i.ok !== null);
  if (decided.length === 0) {
    return axis("compatibility", "Compatibilité documentaire", 1, "unavailable", compat.message);
  }
  const ok = decided.filter((i) => i.ok).length;
  const findings: AxisFinding[] = compat.items
    .filter((i) => i.ok === false)
    .map((i) => ({
      code: `compat_${i.field}`,
      label: `Attribut de modèle différent : ${i.field}`,
      severity: i.field === "format" || i.field === "orientation" ? "high" : "medium",
      determinant: false,
      detail: `Référence : ${i.reference ?? "—"} · Document : ${i.target ?? "—"}`,
    }));
  return axis(
    "compatibility",
    "Compatibilité documentaire",
    1,
    "completed",
    `${ok}/${decided.length} attributs de modèle compatibles.`,
    (ok / decided.length) * 100,
    findings,
  );
}

function axisLayout(template: Template, target: StructuralFingerprint): AxisResult {
  const zones = template.zones.filter((z) => z.role !== "variable");
  if (zones.length === 0 || target.blocks.length === 0) {
    return axis("layout", "Structure et mise en page", 1.4, "unavailable", "Aucune zone positionnée exploitable dans les documents fournis.");
  }
  const findings: AxisFinding[] = [];
  let aligned = 0;
  for (const z of zones) {
    const best = target.blocks.reduce<{ d: number; b: typeof target.blocks[number] } | null>((acc, b) => {
      if (b.page !== z.box.page) return acc;
      const d = Math.hypot(b.x - z.box.x, b.y - z.box.y);
      return !acc || d < acc.d ? { d, b } : acc;
    }, null);
    if (!best) {
      findings.push({
        code: "zone_absente",
        label: "Zone attendue absente",
        severity: "high",
        determinant: false,
        detail: `Aucun bloc à l'emplacement attendu (${z.key}).`,
        location: z.box,
      });
      continue;
    }
    if (best.d <= z.tolerance) aligned++;
    else
      findings.push({
        code: "zone_deplacee",
        label: "Bloc déplacé par rapport au modèle",
        severity: best.d > z.tolerance * 3 ? "high" : "medium",
        // Déterminant seulement si la zone est confirmée fixe par plusieurs
        // exemplaires : avec une référence unique, la tolérance est déduite d'un
        // seul document et un déplacement peut refléter une variante légitime.
        determinant: z.role === "fixed" && best.d > z.tolerance * 4 && template.referenceCount >= 2,
        detail: `Écart de position ${(best.d * 100).toFixed(1)} % (tolérance ${(z.tolerance * 100).toFixed(1)} %).`,
        location: z.box,
      });
  }
  return axis(
    "layout",
    "Structure et mise en page",
    1.4,
    "completed",
    `${aligned}/${zones.length} zones structurelles à leur emplacement attendu.`,
    (aligned / zones.length) * 100,
    findings,
  );
}

function axisTypography(template: Template, target: StructuralFingerprint): AxisResult {
  const overlap = fontOverlap(template.fonts, target.fonts);
  if (overlap === null) {
    return axis("typography", "Typographie", 1.2, "not_applicable", "Aucune information de police exploitable dans ce format.");
  }
  const findings: AxisFinding[] = [];
  // Police différente dans une zone FIXE → indice fort (pas une preuve absolue).
  for (const z of template.zones) {
    if (z.role !== "fixed" || z.fonts.length === 0) continue;
    const expected = new Set(z.fonts.map(familyOf));
    const near = target.blocks.find(
      (b) => b.page === z.box.page && Math.hypot(b.x - z.box.x, b.y - z.box.y) <= Math.max(z.tolerance, 0.05),
    );
    if (near?.font && !expected.has(familyOf(near.font))) {
      findings.push({
        code: "police_zone_fixe",
        label: "Police différente dans une zone fixe",
        severity: "high",
        determinant: false,
        detail: `Attendu : ${Array.from(expected).join(", ")} · Observé : ${familyOf(near.font)}.`,
        location: z.box,
      });
    }
  }
  if (overlap < 0.4) {
    findings.push({
      code: "familles_polices",
      label: "Familles de polices majoritairement différentes",
      severity: "medium",
      determinant: false,
      detail: `Recouvrement des familles : ${(overlap * 100).toFixed(0)} %.`,
    });
  }
  return axis(
    "typography",
    "Typographie",
    1.2,
    "completed",
    `Recouvrement des familles de polices : ${(overlap * 100).toFixed(0)} %.`,
    overlap * 100,
    findings,
    ["Une police différente dans un champ variable est un indice, pas une preuve."],
  );
}

function axisVisual(template: Template, target: StructuralFingerprint): AxisResult {
  const dist = gridDistance(template.inkGrid, target.inkGrid);
  const colorRef = new Set(template.colors);
  const colorHit = target.colors.filter((c) => colorRef.has(c)).length;
  const findings: AxisFinding[] = [];
  if (dist === null) {
    return axis("visual", "Identité visuelle", 1.3, "not_applicable", "Comparaison visuelle indisponible pour ce format (aucun rendu comparable).");
  }
  const score = clamp((1 - Math.min(1, dist * 2.2)) * 100);
  if (dist > 0.18)
    findings.push({
      code: "ecart_visuel_global",
      label: "Écart visuel global important",
      severity: dist > 0.3 ? "high" : "medium",
      determinant: false,
      detail: `Écart moyen d'encrage ${(dist * 100).toFixed(1)} % après alignement.`,
    });
  if (template.colors.length > 0 && colorHit === 0)
    findings.push({
      code: "couleurs_institutionnelles",
      label: "Aucune couleur dominante commune",
      severity: "medium",
      determinant: false,
      detail: `Référence : ${template.colors.join(", ")} · Document : ${target.colors.join(", ") || "—"}.`,
    });
  const refImgs = template.imageBoxes.length;
  const tgtImgs = target.images.length;
  if (refImgs > 0 && tgtImgs === 0)
    findings.push({
      code: "elements_graphiques_absents",
      label: "Éléments graphiques attendus absents",
      severity: "high",
      determinant: false,
      detail: `${refImgs} élément(s) graphique(s) dans la référence, aucun dans le document.`,
    });
  return axis("visual", "Identité visuelle", 1.3, "completed", `Similarité visuelle après alignement : ${score}/100.`, score, findings, [
    CONFORMITY_MESSAGES.physical,
  ]);
}

function axisFixedContent(template: Template, target: StructuralFingerprint): AxisResult {
  if (template.fixedLabels.length === 0) {
    return axis("fixed_content", "Contenu fixe", 1.4, "unavailable", "Aucun libellé fixe n'a pu être identifié dans la référence.");
  }
  const text = target.textNormalized;
  const missing = template.fixedLabels.filter((l) => !text.includes(l));
  // Un libellé n'est réputé invariant que s'il a été confirmé par plusieurs
  // exemplaires fiables. Avec une référence unique, son absence est un écart
  // significatif à vérifier, jamais une preuve déterminante : le libellé déduit
  // pouvait en réalité appartenir à un champ variable.
  const confirmed = template.referenceCount >= 2;
  const findings: AxisFinding[] = missing.map((l) => ({
    code: "libelle_fixe_absent",
    label: "Libellé fixe attendu absent ou modifié",
    severity: confirmed ? "critical" : "high",
    determinant: confirmed,
    detail: confirmed
      ? `Libellé attendu : « ${l} ».`
      : `Libellé attendu : « ${l} ». Déduit d'un seul exemplaire de référence : son caractère invariant n'est pas confirmé.`,
  }));
  const present = template.fixedLabels.length - missing.length;
  return axis(
    "fixed_content",
    "Contenu fixe",
    1.4,
    "completed",
    `${present}/${template.fixedLabels.length} libellés fixes retrouvés.`,
    (present / template.fixedLabels.length) * 100,
    findings,
  );
}

function axisVariableData(template: Template, target: StructuralFingerprint): AxisResult {
  const zones = template.zones.filter((z) => z.role === "variable");
  if (zones.length === 0) {
    return axis("variable_data", "Données variables", 1.1, "unavailable", "Aucun champ variable identifié — une référence unique limite cette distinction.", null, [], [
      "Plusieurs exemplaires fiables permettent d'identifier les champs réellement variables.",
    ]);
  }
  const findings: AxisFinding[] = [];
  let ok = 0;
  for (const z of zones) {
    const near = target.blocks.find(
      (b) => b.page === z.box.page && Math.hypot(b.x - z.box.x, b.y - z.box.y) <= Math.max(z.tolerance * 2, 0.06),
    );
    if (!near) {
      findings.push({
        code: "champ_variable_absent",
        label: "Champ variable absent de sa zone",
        severity: "high",
        determinant: false,
        detail: `Aucune donnée à l'emplacement attendu (${z.key}).`,
        location: z.box,
      });
      continue;
    }
    // Jamais d'égalité : on contrôle emplacement, longueur plausible, syntaxe.
    const lenRef = z.expectedLabel?.length ?? Math.max(1, Math.round(z.box.w * 120));
    const plausible = near.norm.length > 0 && near.norm.length <= Math.max(12, lenRef * 4);
    if (!plausible) {
      findings.push({
        code: "champ_variable_longueur",
        label: "Longueur du champ variable peu plausible",
        severity: "medium",
        determinant: false,
        detail: `Longueur observée ${near.norm.length} caractères.`,
        location: z.box,
      });
      continue;
    }
    ok++;
  }
  return axis(
    "variable_data",
    "Données variables",
    1.1,
    "completed",
    `${ok}/${zones.length} champs variables présents, positionnés et de format plausible.`,
    (ok / zones.length) * 100,
    findings,
    ["Les champs variables ne sont jamais comparés par égalité avec la référence."],
  );
}

function axisMetadata(reference: StructuralFingerprint, target: StructuralFingerprint): AxisResult {
  const keys = new Set([...Object.keys(reference.metadata), ...Object.keys(target.metadata)]);
  if (keys.size === 0) {
    return axis("metadata", "Métadonnées (indice secondaire)", 0.5, "unavailable", "Aucune métadonnée exploitable.");
  }
  const diffs: string[] = [];
  for (const k of keys) {
    const a = reference.metadata[k];
    const b = target.metadata[k];
    if (a && b && a !== b) diffs.push(`${k} : « ${a} » → « ${b} »`);
  }
  return axis(
    "metadata",
    "Métadonnées (indice secondaire)",
    0.5,
    "informational",
    diffs.length === 0
      ? "Aucune divergence notable de métadonnées."
      : `${diffs.length} divergence(s) de métadonnées : ${diffs.slice(0, 6).join(" · ")}`,
    null,
    [],
    [
      "Deux documents légitimes du même modèle peuvent être exportés par des logiciels ou à des dates différents.",
      "Une différence de métadonnées ne suffit pas à déclarer un document falsifié.",
    ],
  );
}


function axisInternal(template: Template, target: StructuralFingerprint): AxisResult {
  const keys = Object.keys(template.internalCommon);
  if (keys.length === 0) {
    return axis("internal", "Structure interne", 1.2, "unavailable", "Structure interne non comparable pour ce format.");
  }
  const findings: AxisFinding[] = [];
  let same = 0;
  for (const k of keys) {
    const a = template.internalCommon[k];
    const b = target.internal[k];
    if (b === undefined) continue;
    if (a === b) same++;
    else
      findings.push({
        code: `structure_${k}`,
        label: `Structure interne différente : ${k}`,
        severity: k.includes("incremental") || k.includes("annot") ? "high" : "medium",
        determinant: false,
        detail: `Référence : ${String(a)} · Document : ${String(b)}`,
      });
  }
  const compared = same + findings.length;
  if (compared === 0) {
    return axis("internal", "Structure interne", 1.2, "unavailable", "Aucun attribut interne commun mesurable.");
  }
  if (target.internal["incremental_updates"] && Number(target.internal["incremental_updates"]) > Number(template.internalCommon["incremental_updates"] ?? 0)) {
    findings.push({
      code: "revision_incrementale",
      label: "Révision incrémentale supplémentaire",
      severity: "high",
      determinant: false,
      detail: "Le document examiné contient des révisions absentes de la référence.",
    });
  }
  return axis(
    "internal",
    "Structure interne",
    1.2,
    "completed",
    `${same}/${compared} attributs internes conformes au modèle.`,
    (same / compared) * 100,
    findings,
  );
}

function axisNormalized(target: StructuralFingerprint): AxisResult {
  const mrz = verifyMrz(target.codes.mrzLines);
  if (!mrz.present || mrz.checks.length === 0) {
    return axis("normalized", "Éléments normalisés", 1.0, "not_applicable", "Aucune zone lisible par machine ni code exploitable dans ce document.");
  }
  const failed = mrz.checks.filter((c) => !c.ok);
  const findings: AxisFinding[] = failed.map((c) => ({
    code: `mrz_${c.field}`,
    label: `Somme de contrôle MRZ invalide : ${c.field}`,
    severity: "critical",
    determinant: true,
    detail: `Attendu ${c.expected}, trouvé ${c.found}.`,
  }));
  const ok = mrz.checks.length - failed.length;
  return axis(
    "normalized",
    "Éléments normalisés",
    1.0,
    "completed",
    `MRZ ${mrz.format} : ${ok}/${mrz.checks.length} sommes de contrôle valides.`,
    (ok / mrz.checks.length) * 100,
    findings,
    ["La réussite d'une somme de contrôle ne prouve pas l'authenticité du document."],
  );
}

function axisRetouch(
  template: Template,
  target: StructuralFingerprint,
  hotspots: Array<{ x: number; y: number; delta: number }>,
): AxisResult {
  if (!template.inkGrid || !target.inkGrid) {
    return axis("retouch", "Indices de retouche", 1.3, "not_applicable", "Aucun rendu comparable : recherche d'intervention localisée non applicable.");
  }
  const findings: AxisFinding[] = [];
  const strong = hotspots.filter((h) => h.delta >= 0.45);
  for (const h of strong.slice(0, 6)) {
    findings.push({
      code: "zone_localement_differente",
      label: "Zone localement très différente du modèle",
      severity: h.delta >= 0.6 ? "high" : "medium",
      determinant: false,
      detail: `Écart local ${(h.delta * 100).toFixed(0)} % en case (${h.x}, ${h.y}).`,
      location: { x: h.x, y: h.y },
    });
  }
  const density = hotspots.length / Math.max(1, template.inkGrid.length);
  const score = clamp((1 - Math.min(1, density * 3)) * 100);
  return axis(
    "retouch",
    "Indices de retouche",
    1.3,
    "completed",
    hotspots.length === 0
      ? "Aucune zone localement incompatible avec le modèle."
      : `${hotspots.length} zone(s) localement divergente(s) dont ${strong.length} marquée(s).`,
    score,
    findings,
    ["Une divergence locale peut provenir d'un champ variable légitime (photo, signature)."],
  );
}

// -------------------------------------------------------------- verdict

const SEV_WEIGHT: Record<Severity, number> = { none: 0, weak: 1, medium: 2, high: 4, critical: 8 };

export function runConformityAnalysis(input: ConformityInput): ConformityOutcome {
  const fingerprintVersion = input.template.version;
  const limitations: string[] = [CONFORMITY_MESSAGES.legal];
  const binaryIdentical =
    !!input.referenceSha256 && !!input.targetSha256 && input.referenceSha256 === input.targetSha256;

  const base = {
    conformityScore: null as number | null,
    coverage: 0,
    reliability: 0,
    compatibility: { status: "unknown", items: [], message: "" } as CompatibilityResult,
    axes: [] as AxisResult[],
    determinantFindings: [] as AxisFinding[],
    hotspots: [] as Array<{ x: number; y: number; delta: number }>,
    gridSize: input.target.inkGridSize,
    binaryIdentical,
    policyVersion: CONFORMITY_POLICY_VERSION,
    fingerprintVersion,
  };

  // 1. Analyse impossible
  if (input.integrity.verified === false) {
    return { ...base, verdict: "IMPOSSIBLE", rule: "Intégrité de l'acquisition non démontrée (empreintes client et serveur différentes).", limitations };
  }
  if (!input.targetReadable) {
    return { ...base, verdict: "IMPOSSIBLE", rule: "Le document examiné n'a pas pu être ouvert ou analysé.", limitations };
  }
  if (!input.referenceAvailable) {
    return { ...base, verdict: "IMPOSSIBLE", rule: "La référence sélectionnée n'est plus accessible ou son empreinte a changé.", limitations };
  }

  const compatibility = checkCompatibility(input);

  // 2. Incompatible → arrêt de la comparaison spécialisée
  if (compatibility.status === "incompatible" && !input.exploratory) {
    return {
      ...base,
      compatibility,
      axes: [axisCompatibility(compatibility)],
      verdict: "INCONCLUSIVE",
      rule: CONFORMITY_MESSAGES.incompatible,
      limitations,
    };
  }

  const hotspots = gridHotspots(input.template.inkGrid, input.target.inkGrid, input.target.inkGridSize);

  const axes: AxisResult[] = [
    axisCompatibility(compatibility),
    axisLayout(input.template, input.target),
    axisTypography(input.template, input.target),
    axisVisual(input.template, input.target),
    axisFixedContent(input.template, input.target),
    axisVariableData(input.template, input.target),
    axisMetadata(input.reference, input.target),
    axisInternal(input.template, input.target),
    axisNormalized(input.target),
    axisRetouch(input.template, input.target, hotspots),
  ];

  const scored = axes.filter((a) => a.status === "completed" && typeof a.score === "number");
  const applicable = axes.filter((a) => a.status !== "not_applicable");
  const coverage = applicable.length
    ? clamp(
        (applicable.filter((a) => a.status === "completed" || a.status === "informational").reduce((s, a) => s + a.weight, 0) /
          applicable.reduce((s, a) => s + a.weight, 0)) *
          100,
      )
    : 0;

  // Score de conformité : minimum pondéré prudent (jamais une simple moyenne).
  const weighted = scored.reduce((s, a) => s + (a.score as number) * a.weight, 0);
  const totalW = scored.reduce((s, a) => s + a.weight, 0);
  const mean = totalW > 0 ? weighted / totalW : null;
  const worst = scored.length ? Math.min(...scored.map((a) => a.score as number)) : null;
  const conformityScore = mean === null || worst === null ? null : clamp(Math.min(mean, (mean + worst) / 2 + 10));

  const findings = axes.flatMap((a) => a.findings);
  const determinantFindings = findings.filter((f) => f.determinant);
  const severityLoad = findings.reduce((s, f) => s + SEV_WEIGHT[f.severity], 0);
  const highCount = findings.filter((f) => f.severity === "high" || f.severity === "critical").length;
  const reliability = clamp(
    (coverage * 0.6 + (input.template.referenceCount > 1 ? 100 : 55) * 0.4) *
      (compatibility.status === "partial" ? 0.85 : 1) *
      (scored.length >= 4 ? 1 : 0.7),
  );

  if (input.template.referenceCount < 2)
    limitations.push("Référence unique : les invariants du modèle sont déduits d'un seul exemplaire, ce qui limite la certitude.");
  if (compatibility.status === "partial") limitations.push(compatibility.message);
  limitations.push(CONFORMITY_MESSAGES.physical);
  for (const a of axes) for (const l of a.limitations) if (!limitations.includes(l)) limitations.push(l);

  const result = { ...base, compatibility, axes, hotspots, determinantFindings, coverage, reliability, conformityScore, limitations };

  // 3. Non conforme — écart déterminant ou convergence d'anomalies
  if (determinantFindings.length > 0) {
    return { ...result, verdict: "NON_CONFORMING", rule: `Écart déterminant détecté : ${determinantFindings[0].label}. ${CONFORMITY_MESSAGES.nonConforming}` };
  }
  if (highCount >= 3 && new Set(findings.map((f) => f.code)).size >= 3) {
    return { ...result, verdict: "NON_CONFORMING", rule: `${highCount} anomalies indépendantes convergent. ${CONFORMITY_MESSAGES.nonConforming}` };
  }

  // 4. Inconcluant — couverture ou fiabilité insuffisante
  if (input.exploratory && compatibility.status === "incompatible") {
    return { ...result, verdict: "INCONCLUSIVE", rule: "Mode exploratoire sur une référence incompatible : le résultat ne peut pas être conclusif." };
  }
  if (coverage < 50 || scored.length < 3) {
    return { ...result, verdict: "INCONCLUSIVE", rule: `Couverture insuffisante (${coverage} %) : trop de contrôles essentiels sont indisponibles.` };
  }

  // 5. Hiérarchie de conformité
  if (highCount >= 2 || severityLoad >= 8) {
    return { ...result, verdict: "DEVIATIONS_TO_VERIFY", rule: "Plusieurs écarts significatifs dont l'origine n'est pas suffisamment certaine — une autre version du modèle reste possible." };
  }
  if (highCount === 1 || severityLoad >= 4) {
    return { ...result, verdict: "DEVIATIONS_TO_VERIFY", rule: "Un écart significatif nécessite une vérification humaine." };
  }
  if (findings.length === 0 && (conformityScore ?? 0) >= 85 && coverage >= 65) {
    return { ...result, verdict: "CONFORMING", rule: CONFORMITY_MESSAGES.conforming };
  }
  return {
    ...result,
    verdict: "PROBABLY_CONFORMING",
    rule: "La majorité des éléments contrôlés sont conformes ; les écarts faibles observés peuvent provenir du scan, de la compression ou d'une variation normale.",
  };
}
