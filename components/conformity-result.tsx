/**
 * Présentation du résultat de conformité à une référence.
 * Distingue toujours : verdict de conformité ≠ authenticité juridique.
 */

import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Ban } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/count-up";
import { ForensicMetric } from "@/components/forensic-interface";
import { SeverityChip, SeverityText } from "@/components/severity";
import { STATUS_LABEL } from "@/lib/forensic/engine-result";
import {
  CONFORMITY_MESSAGES,
  CONFORMITY_VERDICT_LABEL,
  type ConformityOutcome,
  type ConformityVerdict,
} from "@/lib/forensic/conformity-engine";

const VERDICT_ICON: Record<ConformityVerdict, typeof CheckCircle2> = {
  CONFORMING: CheckCircle2,
  PROBABLY_CONFORMING: CheckCircle2,
  DEVIATIONS_TO_VERIFY: AlertTriangle,
  NON_CONFORMING: XCircle,
  INCONCLUSIVE: HelpCircle,
  IMPOSSIBLE: Ban,
};

const VERDICT_TONE: Record<ConformityVerdict, string> = {
  CONFORMING: "text-trust-authentic",
  PROBABLY_CONFORMING: "text-trust-authentic",
  DEVIATIONS_TO_VERIFY: "text-trust-suspect",
  NON_CONFORMING: "text-trust-falsified",
  INCONCLUSIVE: "text-muted-foreground",
  IMPOSSIBLE: "text-muted-foreground",
};

/** Carte des différences localisées, expliquée (jamais une heatmap brute). */
function DifferenceMap({ outcome }: { outcome: ConformityOutcome }) {
  const size = outcome.gridSize;
  if (!size || outcome.hotspots.length === 0) return null;
  const map = new Map(outcome.hotspots.map((h) => [`${h.x},${h.y}`, h.delta]));
  return (
    <div className="space-y-2">
      <p className="font-mono-display text-xs uppercase tracking-widest">Carte des écarts localisés</p>
      <p className="text-muted-foreground text-xs">
        Chaque case représente une zone du document après alignement. Plus la case est marquée, plus la zone diffère du
        modèle de référence. Une case marquée peut correspondre à un champ variable légitime (photographie, signature).
      </p>
      <div
        className="border-line-command grid w-full max-w-[320px] gap-px border p-px"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${outcome.hotspots.length} zones divergentes localisées`}
      >
        {Array.from({ length: size * size }, (_, i) => {
          const x = i % size;
          const y = Math.floor(i / size);
          const delta = map.get(`${x},${y}`) ?? 0;
          return (
            <span
              key={i}
              className="aspect-square"
              style={{ backgroundColor: delta ? `color-mix(in oklch, var(--trust-falsified) ${Math.round(delta * 100)}%, transparent)` : "transparent" }}
              title={delta ? `Écart ${(delta * 100).toFixed(0)} % en (${x}, ${y})` : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ConformityResult({
  outcome,
  referenceName,
  forensicVerdictLabel,
}: {
  outcome: ConformityOutcome;
  referenceName: string;
  forensicVerdictLabel?: string | null;
}) {
  const Icon = VERDICT_ICON[outcome.verdict];
  return (
    <div className="space-y-4">
      <Card className="command-surface">
        <CardHeader className="pb-2">
          <CardTitle className={`flex flex-wrap items-center gap-2 text-base ${VERDICT_TONE[outcome.verdict]}`}>
            <Icon className="h-5 w-5" aria-hidden />
            <span className="font-mono-display uppercase tracking-widest">{CONFORMITY_VERDICT_LABEL[outcome.verdict]}</span>
          </CardTitle>
          <CardDescription>{outcome.rule}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ForensicMetric
              label="Score de conformité"
              value={outcome.conformityScore === null ? "—" : <CountUp value={outcome.conformityScore} />}
              suffix={outcome.conformityScore === null ? undefined : "/100"}
              detail={outcome.conformityScore === null ? "Non calculable" : "Éléments contrôlés"}
            />
            <ForensicMetric label="Couverture" value={<CountUp value={outcome.coverage} />} suffix="%" detail="Contrôles réellement exécutés" />
            <ForensicMetric label="Fiabilité" value={<CountUp value={outcome.reliability} />} suffix="%" detail="Qualité de la démonstration" />
            <ForensicMetric label="Référence utilisée" value={referenceName} detail={`Compatibilité : ${outcome.compatibility.status}`} />
          </div>

          {outcome.binaryIdentical && (
            <p className="command-inset p-3 text-sm">{CONFORMITY_MESSAGES.binaryIdentical}</p>
          )}

          <p className="text-muted-foreground border-line-command border-l-2 pl-3 text-xs">
            Ce verdict porte sur la conformité technique au modèle de la référence sélectionnée. {CONFORMITY_MESSAGES.legal}
          </p>

          {forensicVerdictLabel && (
            <p className="text-sm">
              <span className="font-mono-display text-muted-foreground uppercase tracking-widest">Verdict forensic indépendant du fichier : </span>
              {forensicVerdictLabel}
            </p>
          )}
        </CardContent>
      </Card>

      {outcome.determinantFindings.length > 0 && (
        <Card className="command-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Preuves déterminantes</CardTitle>
            <CardDescription>Écarts suffisant à eux seuls pour conclure à une non-conformité technique.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {outcome.determinantFindings.map((f, i) => (
              <div key={`${f.code}-${i}`} className="severity-line" data-level={f.severity}>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-muted-foreground text-xs">{f.detail}</p>
                <SeverityChip value={f.severity} prefix="Gravité" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="command-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Axes de comparaison</CardTitle>
          <CardDescription>
            Chaque axe est indépendant. Un axe non applicable ou indisponible ne reçoit aucun score, mais réduit la
            couverture.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="command-table">
              <thead>
                <tr>
                  <th>Axe</th>
                  <th>Statut</th>
                  <th>Score</th>
                  <th>Résumé</th>
                </tr>
              </thead>
              <tbody className="reveal-sequence text-xs">
                {outcome.axes.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Axe">{a.label}</td>
                    <td data-label="Statut" className="font-mono-display">{STATUS_LABEL[a.status]}</td>
                    <td data-label="Score" className="font-mono-display tabular-nums">{a.score === null ? "—" : `${Math.round(a.score)}/100`}</td>
                    <td data-label="Résumé" className="max-w-[360px]">{a.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {outcome.axes.some((a) => a.findings.length > 0) && (
            <div className="space-y-2">
              <p className="font-mono-display text-xs uppercase tracking-widest">Écarts relevés</p>
              {outcome.axes.flatMap((a) =>
                a.findings.map((f, i) => (
                  <div key={`${a.id}-${f.code}-${i}`} className="severity-line" data-level={f.severity}>
                    <p className="text-sm">
                      <span className="text-muted-foreground font-mono-display text-xs uppercase">{a.label} — </span>
                      {f.label}
                    </p>
                    <p className="text-muted-foreground text-xs">{f.detail}</p>
                    <SeverityText value={f.severity} prefix="Gravité" />
                  </div>
                )),
              )}
            </div>
          )}

          <DifferenceMap outcome={outcome} />
        </CardContent>
      </Card>

      <Card className="command-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Limites de l'analyse</CardTitle>
          <CardDescription>Ce que cette comparaison ne démontre pas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
            {outcome.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <p className="text-muted-foreground font-mono-display mt-3 text-[11px] uppercase tracking-widest">
            Politique {outcome.policyVersion} · Empreinte structurelle {outcome.fingerprintVersion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
