import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Animated count-up that starts when the element enters the viewport. */
export function CountUp({
  value,
  duration = 800,
  className,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const seen = useRef(false);
  const from = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced()) {
      setDisplay(value);
      from.current = value;
      return;
    }

    let raf = 0;
    const run = () => {
      const start = from.current;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        setDisplay(start + (value - start) * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
        else {
          setDisplay(value);
          from.current = value;
        }
      };
      raf = requestAnimationFrame(tick);
    };

    // Value updated after the element was already visible → animate right away.
    if (seen.current) {
      run();
      return () => cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seen.current = true;
          run();
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Large "arsenal" figure + small caps label, reused on landing & dashboard. */
export function StatFigure({
  value,
  label,
  suffix,
  decimals,
  tone = "cyan",
}: {
  value: number;
  label: string;
  suffix?: string;
  decimals?: number;
  tone?: "cyan" | "violet" | "authentic" | "suspect";
}) {
  const toneCls = {
    cyan: "text-accent-cyan",
    violet: "text-accent-violet",
    authentic: "text-trust-authentic",
    suspect: "text-trust-suspect",
  }[tone];

  return (
    <div className="text-center">
      <p className={cn("font-mono-display text-4xl font-bold sm:text-5xl", toneCls)}>
        <CountUp value={value} suffix={suffix} decimals={decimals} />
      </p>
      <p className="mt-2 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
