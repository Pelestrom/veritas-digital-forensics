import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Linear score bar with the signature cyan→violet gradient and a
 * progressive fill animation on mount.
 */
export function ScoreBar({
  label,
  value,
  max = 100,
  suffix = "%",
  tone = "signature",
  className,
}: {
  label?: string;
  value: number;
  max?: number;
  suffix?: string;
  tone?: "signature" | "authentic" | "suspect" | "falsified";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const fill = {
    signature: "bg-signature",
    authentic: "bg-trust-authentic",
    suspect: "bg-trust-suspect",
    falsified: "bg-trust-falsified",
  }[tone];

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="font-mono-display text-sm font-semibold tabular-nums">
            {Math.round(value)}
            {suffix}
          </span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fill)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
