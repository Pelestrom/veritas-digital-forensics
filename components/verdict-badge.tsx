import { CheckCircle2, ShieldAlert, ShieldX, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type Verdict =
  | "authentic"
  | "authentic_probable"
  | "suspect"
  | "manipulated"
  | "falsified"
  | "unknown"
  | "analysis_impossible";

const config: Record<Verdict, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  authentic: {
    label: "Authentique",
    icon: CheckCircle2,
    cls: "bg-[oklch(0.72_0.17_155/0.15)] text-trust-authentic border-[oklch(0.72_0.17_155/0.4)]",
  },
  authentic_probable: {
    label: "Authentique probable",
    icon: CheckCircle2,
    cls: "bg-[oklch(0.72_0.17_155/0.1)] text-trust-authentic border-[oklch(0.72_0.17_155/0.3)]",
  },
  suspect: {
    label: "Suspect",
    icon: ShieldAlert,
    cls: "bg-[oklch(0.78_0.16_85/0.15)] text-trust-suspect border-[oklch(0.78_0.16_85/0.4)]",
  },
  manipulated: {
    label: "Manipulé",
    icon: AlertTriangle,
    cls: "bg-[oklch(0.70_0.20_40/0.15)] text-trust-manipulated border-[oklch(0.70_0.20_40/0.4)]",
  },
  falsified: {
    label: "Falsifié",
    icon: ShieldX,
    cls: "bg-[oklch(0.62_0.22_25/0.15)] text-trust-falsified border-[oklch(0.62_0.22_25/0.4)]",
  },
  analysis_impossible: {
    label: "Analyse impossible",
    icon: ShieldX,
    cls: "bg-[oklch(0.62_0.22_25/0.12)] text-trust-falsified border-[oklch(0.62_0.22_25/0.35)]",
  },
  unknown: {
    label: "En attente",
    icon: HelpCircle,
    cls: "bg-muted text-trust-unknown border-border",
  },
};

const alerting: Verdict[] = ["manipulated", "falsified", "suspect", "unknown", "analysis_impossible"];

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const c = config[verdict];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium font-mono-display uppercase tracking-wider",
        c.cls,
        className,
      )}
    >
      {alerting.includes(verdict) ? (
        <span
          aria-hidden
          className="status-dot h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]"
        />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {c.label}
    </span>
  );
}

