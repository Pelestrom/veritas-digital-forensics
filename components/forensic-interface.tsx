import { useState, type ComponentType, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  CircleSlash,
  Copy,
  Loader2,
} from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { cn } from "@/lib/utils";
import { ENGINE_META, type EngineId } from "@/lib/forensic/engines";
import type { EngineStatus } from "@/lib/forensic/engine-result";

export function ForensicPageHeader({
  eyebrow,
  title,
  description,
  actions,
  backAction,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backAction?: ReactNode;
}) {
  return (
    <header className="forensic-page-header">
      <div className="min-w-0">
        {backAction}
        <p className="forensic-eyebrow">
          <span aria-hidden className="forensic-index-mark" />
          {eyebrow}
        </p>
        <h1 className="forensic-page-title">{title}</h1>
        {description && <p className="forensic-page-description">{description}</p>}
      </div>
      {actions && <div className="forensic-page-actions">{actions}</div>}
    </header>
  );
}

export type PathState =
  | "idle"
  | "active"
  | "completed"
  | "informational"
  | "not_applicable"
  | "unavailable"
  | "error";

const pathIcon: Record<PathState, ComponentType<{ className?: string }>> = {
  idle: CircleDashed,
  active: Loader2,
  completed: Check,
  informational: Check,
  not_applicable: CircleSlash,
  unavailable: CircleAlert,
  error: CircleAlert,
};

export function EvidenceLightPath({
  steps,
  compact = false,
  label = "Parcours de la preuve",
}: {
  steps: Array<{ id: string; label: string; detail?: string; state: PathState }>;
  compact?: boolean;
  label?: string;
}) {
  return (
    <div className={cn("evidence-path", compact && "evidence-path--compact")} aria-label={label}>
      {steps.map((step, index) => {
        const Icon = pathIcon[step.state];
        return (
          <div key={step.id} className={cn("evidence-path__step", `is-${step.state}`)}>
            <div className="evidence-path__rail" aria-hidden>
              <span className="evidence-path__node">
                <Icon className={cn("h-3.5 w-3.5", step.state === "active" && "animate-spin")} />
              </span>
              {index < steps.length - 1 && <span className="evidence-path__line" />}
            </div>
            <div className="min-w-0">
              <p className="evidence-path__label">{step.label}</p>
              {step.detail && <p className="evidence-path__detail">{step.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EngineStateStrip({
  states,
}: {
  states: Partial<Record<EngineId, EngineStatus | "active" | "idle">>;
}) {
  return (
    <div className="engine-state-strip" aria-label="État des quatre moteurs d’analyse">
      {(["crypto", "metadata", "structure", "ai"] as const).map((id, index) => {
        const state = states[id] ?? "idle";
        return (
          <div key={id} className={cn("engine-state-strip__item", `is-${state}`)}>
            <span className="engine-state-strip__index">0{index + 1}</span>
            <span className="min-w-0">
              <strong>{ENGINE_META[id].short}</strong>
              <small>
                {state === "active"
                  ? "En cours"
                  : state === "idle"
                    ? "En attente"
                    : state.replace("_", " ")}
              </small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ForensicMetric({
  label,
  value,
  suffix,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  detail?: string;
  tone?: "neutral" | "primary" | "authentic" | "suspect" | "falsified";
}) {
  return (
    <div className={cn("forensic-metric", `is-${tone}`)}>
      <p>{label}</p>
      <strong>
        {value}
        {suffix && <small>{suffix}</small>}
      </strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

/** Empreinte technique copiable — retour immédiat, sans dépendre de la couleur seule. */
export function HashChip({ value, label = "SHA-256" }: { value: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return (
      <span className="hash-chip is-empty">
        <span className="hash-chip__label">{label}</span>
        <span className="hash-chip__value">non disponible</span>
      </span>
    );
  }
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="hash-chip">
      <span className="hash-chip__label">{label}</span>
      <span className="hash-chip__value" title={value}>
        {value.slice(0, 16)}…{value.slice(-8)}
      </span>
      <button
        type="button"
        className="hash-chip__copy"
        onClick={onCopy}
        aria-label={`Copier l’empreinte ${label}`}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        <span>{copied ? "Copié" : "Copier"}</span>
      </button>
    </span>
  );
}

export type FactKind = "confirmed" | "probable" | "hypothesis" | "unknown";

const FACT_LABEL: Record<FactKind, string> = {
  confirmed: "Fait confirmé",
  probable: "Événement probable",
  hypothesis: "Hypothèse",
  unknown: "Donnée inconnue",
};

/** Qualifie la nature d’un événement de la chronologie : jamais présenté comme certitude absolue. */
export function FactBadge({ kind }: { kind: FactKind }) {
  return <span className={cn("fact-badge", `is-${kind}`)}>{FACT_LABEL[kind]}</span>;
}

/** Squelette de chargement fidèle à la structure finale d’une page d’analyse. */
export function AnalysisSkeleton() {
  return (
    <div
      className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Chargement de l’analyse…</p>
      <div className="space-y-3">
        <div className="skeleton-line" style={{ width: "10rem", height: "0.6rem" }} />
        <div className="skeleton-line" style={{ width: "min(28rem, 80%)", height: "1.9rem" }} />
        <div className="skeleton-line" style={{ width: "min(20rem, 60%)", height: "0.8rem" }} />
      </div>
      <div className="command-surface p-5">
        <div className="skeleton-line" style={{ height: "2.5rem" }} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="command-surface p-5 space-y-3">
          <div className="skeleton-line" style={{ width: "8rem", height: "0.6rem" }} />
          <div className="skeleton-line" style={{ width: "12rem", height: "2rem" }} />
          <div className="skeleton-line" style={{ height: "0.8rem" }} />
        </div>
        <div className="command-surface p-5 space-y-3">
          <div className="skeleton-line" style={{ width: "8rem", height: "0.6rem" }} />
          <div className="skeleton-line" style={{ height: "0.8rem" }} />
          <div className="skeleton-line" style={{ height: "0.8rem" }} />
          <div className="skeleton-line" style={{ width: "60%", height: "0.8rem" }} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="command-surface p-4 space-y-3">
            <div className="skeleton-line" style={{ width: "6rem", height: "0.6rem" }} />
            <div className="skeleton-line" style={{ width: "4rem", height: "1.6rem" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Section repliable partagée : bouton discret (texte + chevron), aria-expanded /
 * aria-controls gérés par Radix, animation de hauteur sans saut de mise en page.
 * L'état ouvert/fermé n'a aucun effet sur les résultats affichés.
 */
export function DisclosureSection({
  label,
  openLabel = "Réduire",
  count,
  defaultOpen = false,
  children,
  className,
}: {
  label: string;
  openLabel?: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("disclosure", className)}>
      <CollapsibleTrigger className="disclosure__trigger">
        <span>{open ? openLabel : label}</span>
        {typeof count === "number" && <span className="disclosure__count">{count}</span>}
        <ChevronDown aria-hidden className="disclosure__chevron h-3.5 w-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent className="disclosure__content">
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
