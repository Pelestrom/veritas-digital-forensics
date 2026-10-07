/**
 * Affichage de la gravité : une seule lecture visuelle pour tous les écrans.
 *
 * La couleur porte le niveau, le libellé reste écrit — la lecture ne dépend
 * donc jamais de la couleur seule (accessibilité, daltonisme, impression).
 */

import {
  SEVERITY_SCALE,
  levelFromSeverityScore,
  severityHex,
  severityLabel,
  severityRgb,
  toSeverityLevel,
  type SeverityInput,
  type SeverityLevel,
} from "@/lib/forensic/severity-scale";

export {
  SEVERITY_SCALE,
  levelFromSeverityScore,
  severityHex,
  severityLabel,
  severityRgb,
  toSeverityLevel,
};
export type { SeverityLevel };

/** Libellé + pastille de couleur du niveau. */
export function SeverityChip({
  value,
  prefix,
  className = "",
}: {
  value: SeverityInput;
  prefix?: string;
  className?: string;
}) {
  const level = toSeverityLevel(value);
  return (
    <span
      className={`severity-chip ${className}`}
      data-level={level}
      title={`Gravité ${severityLabel(value)}`}
    >
      <span className="severity-chip__dot" aria-hidden="true" />
      {prefix ? `${prefix} ` : ""}
      {SEVERITY_SCALE[level].label}
    </span>
  );
}

/** Texte coloré selon le niveau, sans pastille (liste dense, tableaux). */
export function SeverityText({
  value,
  prefix,
  short = false,
  className = "",
}: {
  value: SeverityInput;
  prefix?: string;
  /** Libellé court (« Info ») pour les colonnes serrées. */
  short?: boolean;
  className?: string;
}) {
  const level = toSeverityLevel(value);
  return (
    <span className={`severity-text ${className}`} data-level={level}>
      {prefix && <span className="text-muted-foreground">{prefix} </span>}
      {short ? SEVERITY_SCALE[level].short : SEVERITY_SCALE[level].label}
    </span>
  );
}

/**
 * Valeur numérique de gravité (score de preuve) rendue dans la couleur du
 * niveau qui lui correspond.
 */
export function SeverityValue({
  score,
  raw,
  className = "",
}: {
  score: number | null | undefined;
  raw?: SeverityInput;
  className?: string;
}) {
  const level = raw != null ? toSeverityLevel(raw) : levelFromSeverityScore(score);
  return (
    <span className={`severity-text ${className}`} data-level={level}>
      {typeof score === "number" ? score : "—"}
    </span>
  );
}

/** Classe de couleur pour un usage dans un className Tailwind existant. */
export function severityTextClass(value: SeverityInput): string {
  return `severity-text severity-text--${toSeverityLevel(value)}`;
}

const SEVERITY_IN_TEXT =
  /(gravit[ée]\s+)(critical|high|medium|low|info|critique|élevée|elevée|élevé|elevé|moyenne|moyen|faible|informative|\d{1,3}(?:\s*\/\s*100)?)/gi;

/**
 * Rendu d'une phrase libre (raison du verdict, détail de chronologie) dans
 * laquelle une mention de gravité prend la couleur de son niveau.
 */
export function SeverityInline({ text, className = "" }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  SEVERITY_IN_TEXT.lastIndex = 0;
  while ((match = SEVERITY_IN_TEXT.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[2];
    const level = /^\d/.test(raw)
      ? levelFromSeverityScore(parseInt(raw, 10))
      : toSeverityLevel(raw);
    parts.push(
      <span key={`p-${match.index}`} className="text-muted-foreground">{match[1]}</span>,
    );
    parts.push(
      <span key={`l-${match.index}`} className="severity-text" data-level={level}>
        {/^\d/.test(raw) ? raw : SEVERITY_SCALE[level].label}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}
