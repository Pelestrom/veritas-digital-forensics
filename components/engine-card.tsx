import { Activity, AlertTriangle, CircleSlash, HelpCircle, Info } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ENGINE_META } from "@/lib/forensic/engines";
import { STATUS_LABEL, type EngineResult, type EngineStatus } from "@/lib/forensic/engine-result";
import { CRYPTO_MESSAGES } from "@/lib/forensic/crypto-engine";
import { DisclosureSection } from "@/components/forensic-interface";

const STATUS_STYLE: Record<EngineStatus, string> = {
  completed: "border-primary/40 bg-primary/10 text-primary",
  informational: "border-border bg-muted/40 text-muted-foreground",
  not_applicable: "border-border bg-muted/30 text-muted-foreground",
  unavailable: "border-trust-suspect/40 bg-trust-suspect/10 text-trust-suspect",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

const STATUS_ICON: Record<EngineStatus, typeof Info> = {
  completed: Activity,
  informational: Info,
  not_applicable: CircleSlash,
  unavailable: AlertTriangle,
  error: AlertTriangle,
};

export function StatusChip({ status }: { status: EngineStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono-display uppercase tracking-wider ${STATUS_STYLE[status]}`}
    >
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const WEIGHT_TOOLTIP =
  "Le poids affiché est le poids effectif renormalisé : poids de base × applicabilité × disponibilité × couverture × fiabilité, puis ramené à 100 % sur les moteurs contributifs.";

export function EngineCard({
  engine,
  cryptoNote,
}: {
  engine: EngineResult;
  cryptoNote?: string | null;
}) {
  const meta = ENGINE_META[engine.engineId];
  const scorable = typeof engine.score === "number";
  const hasSubtests = engine.subtests.length > 0;
  const shouldKeepOpen = engine.subtests.some(
    (s) =>
      s.status === "error" ||
      s.status === "unavailable" ||
      (s.status === "completed" && s.score !== null && s.score <= 25),
  );

  return (
    <Card className="command-surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="font-mono-display uppercase tracking-wider">
            {meta.short}{" "}
            <span className="text-muted-foreground normal-case tracking-normal">— {meta.full}</span>
          </span>
          <span className="font-mono-display tabular-nums">
            {scorable ? `${engine.score}/100` : "—"}
          </span>
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">{meta.description}</span>
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={engine.status} />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-mono-display uppercase tracking-wider text-muted-foreground">
                    Poids {engine.normalizedWeight} % <HelpCircle className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">{WEIGHT_TOOLTIP}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-mono-display uppercase tracking-wider text-muted-foreground">
              Couverture {engine.coverage} %
            </span>
            <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-mono-display uppercase tracking-wider text-muted-foreground">
              Fiabilité {engine.confidence} %
            </span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {scorable ? (
          <Progress value={engine.score ?? 0} className="h-2" />
        ) : (
          <div className="h-2 rounded-full border border-dashed border-border" />
        )}
        <p
          className="line-clamp-2 text-xs text-muted-foreground break-words"
          title={engine.summary}
        >
          {engine.summary}
        </p>

        {engine.engineId === "crypto" && (
          <div className="rounded-md border border-border bg-muted/20 p-2 text-[11px] font-mono-display break-all">
            <p>clientHash : {String(engine.technicalDetails.clientHash ?? "—")}</p>
            <p>serverHash : {String(engine.technicalDetails.serverHash ?? "non calculé")}</p>
            <p className="mt-1 text-muted-foreground">
              {cryptoNote ??
                (engine.technicalDetails.hashMatch === true
                  ? CRYPTO_MESSAGES.verified
                  : engine.technicalDetails.hashMatch === false
                    ? CRYPTO_MESSAGES.mismatch
                    : CRYPTO_MESSAGES.unavailable)}
            </p>
          </div>
        )}

        {hasSubtests && (
          <Accordion
            type="single"
            collapsible
            defaultValue={shouldKeepOpen ? "subtests" : undefined}
            className="w-full"
          >
            <AccordionItem value="subtests" className="border-0">
              <AccordionTrigger className="justify-between gap-3 rounded-md border border-border bg-muted/30 px-2.5 py-2 text-[10px] font-mono-display uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground">
                <span>
                  {engine.subtests.length > 3
                    ? "Afficher les sous-tests"
                    : "Détails des sous-tests"}
                </span>
                <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[9px] text-foreground">
                  {engine.subtests.length}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-2">
                  {engine.subtests.map((s) => (
                    <div key={s.id} className="rounded-md border border-border/60 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium">{s.label}</span>
                        <span className="flex items-center gap-2">
                          <StatusChip status={s.status} />
                          <span className="font-mono-display text-xs tabular-nums">
                            {typeof s.score === "number" ? `${s.score}/100` : "—"}
                          </span>
                        </span>
                      </div>
                      {typeof s.score === "number" && (
                        <Progress value={s.score} className="mt-1 h-1" />
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground break-words">
                        {s.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {engine.engineId === "ai" && typeof engine.technicalDetails?.aiDetails === "string" && (
          <AiDetails raw={engine.technicalDetails.aiDetails} />
        )}

        {engine.limitations.length > 0 && (
          <DisclosureSection label="Limites de l’analyse" count={engine.limitations.length}>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {engine.limitations.map((l, i) => (
                <li key={i} className="flex gap-1">
                  <span>·</span>
                  <span className="break-words">{l}</span>
                </li>
              ))}
            </ul>
          </DisclosureSection>
        )}
        <p className="font-mono-display text-[10px] uppercase tracking-wider text-muted-foreground">
          Version moteur {engine.engineVersion}
        </p>
      </CardContent>
    </Card>
  );
}

const REGION_CLASS: Record<string, string> = {
  synthetic: "synthétique",
  photographic: "photographique",
  edited: "retouchée",
  uncertain: "incertaine",
};
const STRENGTH: Record<string, string> = { weak: "faible", moderate: "modéré", strong: "fort" };

function AiDetails({ raw }: { raw: string }) {
  let d: {
    contentType?: string;
    regionalPass?: boolean;
    realSubjectLikely?: boolean;
    syntheticBackgroundLikely?: boolean;
    compositingDetected?: boolean;
    regions?: { name: string; classification: string; strength: string; indicators: string[] }[];
    globalIndicators?: string[];
    limitations?: string[];
    cached?: boolean;
  };
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  return (
    <details className="rounded-md border border-border/60 p-2 text-[11px]">
      <summary className="cursor-pointer font-mono-display text-[10px] uppercase tracking-wider text-muted-foreground">
        Détails de l'analyse IA
      </summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
        <p>
          Nature : {d.contentType ?? "—"} · Analyse régionale :{" "}
          {d.regionalPass ? "effectuée" : "non déclenchée"}
          {d.cached ? " · résultat réutilisé (même fichier)" : ""} · Fiabilité du moteur : limitée
        </p>
        <p>
          Sujet réel probable : {d.realSubjectLikely ? "oui" : "non"} · Arrière-plan synthétique
          probable : {d.syntheticBackgroundLikely ? "oui" : "non"} · Composition détectée :{" "}
          {d.compositingDetected ? "oui" : "non"}
        </p>
        {(d.regions ?? []).map((r, i) => (
          <div key={i} className="rounded border border-border/40 p-1.5">
            <span className="font-medium text-foreground">{r.name}</span> —{" "}
            {REGION_CLASS[r.classification] ?? r.classification} (
            {STRENGTH[r.strength] ?? r.strength})
            {r.indicators?.length > 0 && (
              <span className="block break-words">{r.indicators.join(" · ")}</span>
            )}
          </div>
        ))}
        {(d.globalIndicators ?? []).length > 0 && (
          <p className="break-words">Indices globaux : {d.globalIndicators!.join(" · ")}</p>
        )}
        {(d.limitations ?? []).length > 0 && (
          <p className="break-words">Limites : {d.limitations!.join(" · ")}</p>
        )}
      </div>
    </details>
  );
}
