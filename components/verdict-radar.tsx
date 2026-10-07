import { useId, useState } from "react";

export interface VerdictRadarDatum {
  name: string;
  value: number;
  color: string;
}

interface VerdictRadarProps {
  data: VerdictRadarDatum[];
  total: number;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 104;
const RINGS = 6;

function pointFor(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function pointsString(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function VerdictRadar({ data, total }: VerdictRadarProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const count = data.length;
  const axisPoints = data.map((_, index) => pointFor(index, count, RADIUS));
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const valuePoints = data.map((item, index) =>
    pointFor(index, count, (item.value / maxValue) * RADIUS),
  );
  const active = activeIndex === null ? null : data[activeIndex];
  const activePoint = activeIndex === null ? null : valuePoints[activeIndex];
  const activePercentage = active && total > 0 ? Math.round((active.value / total) * 100) : 0;

  return (
    <div
      className="verdict-radar"
      role="img"
      aria-label={`Distribution des verdicts sur ${total} analyses`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="verdict-radar__svg" aria-hidden="true">
        <defs>
          {/* Gradient radial: cyan intense au centre, transparent sur les bords. */}
          <radialGradient id={`radar-fill-${gradientId}`} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.62" />
            <stop offset="72%" stopColor="var(--accent-teal)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.04" />
          </radialGradient>
          <filter id={`radar-glow-${gradientId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="verdict-radar__scan" transform={`rotate(0 ${CENTER} ${CENTER})`}>
          <line x1={CENTER} y1={CENTER} x2={CENTER} y2={CENTER - RADIUS} />
        </g>

        <g className="verdict-radar__web">
          {/* Anneaux concentriques + rayons: vraie toile, plutôt qu'une grille Recharts plate. */}
          {Array.from({ length: RINGS }, (_, ringIndex) => {
            const ringPoints = axisPoints.map((_, axisIndex) =>
              pointFor(axisIndex, count, (RADIUS / RINGS) * (ringIndex + 1)),
            );
            return <polygon key={`ring-${ringIndex}`} points={pointsString(ringPoints)} />;
          })}
          {axisPoints.map((point, index) => (
            <line key={`axis-${index}`} x1={CENTER} y1={CENTER} x2={point.x} y2={point.y} />
          ))}
        </g>

        <polygon
          className="verdict-radar__data"
          points={pointsString(valuePoints)}
          fill={`url(#radar-fill-${gradientId})`}
          filter={`url(#radar-glow-${gradientId})`}
        />

        {data.map((item, index) => {
          const point = valuePoints[index]!;
          const axis = axisPoints[index]!;
          const size = 3.5 + (item.value / maxValue) * 4;
          return (
            <g
              key={item.name}
              className="verdict-radar__node"
              tabIndex={0}
              role="button"
              aria-label={`${item.name}: ${item.value} analyses, ${total > 0 ? Math.round((item.value / total) * 100) : 0}%`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            >
              <circle
                className="verdict-radar__node-ping"
                cx={point.x}
                cy={point.y}
                r={size + 3}
                style={{ color: item.color }}
              />
              <circle
                className="verdict-radar__node-halo"
                cx={point.x}
                cy={point.y}
                r={size + 2}
                style={{ fill: item.color }}
              />
              <circle
                className="verdict-radar__node-dot"
                cx={point.x}
                cy={point.y}
                r={size}
                style={{ fill: item.color }}
              />
              <text
                className="verdict-radar__label"
                x={axis.x}
                y={axis.y + (axis.y < CENTER ? -10 : 16)}
                textAnchor={axis.x < CENTER - 8 ? "end" : axis.x > CENTER + 8 ? "start" : "middle"}
              >
                {item.name}
              </text>
            </g>
          );
        })}

        <circle className="verdict-radar__center" cx={CENTER} cy={CENTER} r="2.5" />

        {active && activePoint && (
          <g
            className="verdict-radar__tooltip"
            transform={`translate(${Math.min(activePoint.x + 12, 245)} ${Math.max(activePoint.y - 28, 8)})`}
          >
            <rect width="66" height="36" rx="5" />
            <text x="8" y="14">
              {active.name}
            </text>
            <text x="8" y="28">
              {active.value} · {activePercentage}%
            </text>
          </g>
        )}
      </svg>
      <p className="sr-only">Survolez un point pour afficher le nombre et le pourcentage exacts.</p>
    </div>
  );
}
