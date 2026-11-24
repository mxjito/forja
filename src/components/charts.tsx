import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Escala «bonita» para el eje Y. */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

export interface LinePoint {
  x: number;
  y: number;
  /** Segunda serie opcional (tendencia). */
  y2?: number;
}

export function LineChart({
  data,
  height = 180,
  fmtY,
  fmtX,
  tooltip,
  goal,
  goalLabel,
  showDots = true,
  primaryLabel,
  secondaryLabel,
  area = true,
}: {
  data: LinePoint[];
  height?: number;
  fmtY: (v: number) => string;
  fmtX: (v: number) => string;
  tooltip?: (p: LinePoint) => ReactNode;
  goal?: number;
  goalLabel?: string;
  showDots?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
  area?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const hasY2 = data.some((d) => d.y2 != null);

  const geo = useMemo(() => {
    if (!data.length) return null;
    const ys = data.flatMap((d) => (d.y2 != null ? [d.y, d.y2] : [d.y]));
    if (goal != null) ys.push(goal);
    const { lo, hi, ticks } = niceTicks(Math.min(...ys), Math.max(...ys));
    const x0 = data[0].x;
    const x1 = data[data.length - 1].x;
    const sx = (x: number) => (x1 === x0 ? padL + (width - padL - padR) / 2 : padL + ((x - x0) / (x1 - x0)) * (width - padL - padR));
    const sy = (y: number) => padT + (1 - (y - lo) / (hi - lo || 1)) * (height - padT - padB);
    return { lo, hi, ticks, sx, sy, x0, x1 };
  }, [data, width, height, goal]);

  if (!geo) return null;
  const { ticks, sx, sy, x0, x1 } = geo;
  const path = (key: 'y' | 'y2') =>
    data
      .filter((d) => d[key] != null)
      .map((d, i) => `${i ? 'L' : 'M'}${sx(d.x).toFixed(1)},${sy(d[key] as number).toFixed(1)}`)
      .join('');
  const mainKey = hasY2 ? 'y2' : 'y';
  const areaPath = `${path(mainKey)}L${sx(data[data.length - 1].x)},${height - padB}L${sx(data[0].x)},${height - padB}Z`;

  const pick = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    let bd = Infinity;
    data.forEach((d, i) => {
      const dd = Math.abs(sx(d.x) - x);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    setHover(best);
  };

  const xTicks = data.length === 1 ? [x0] : [x0, (x0 + x1) / 2, x1];
  const hp = hover != null ? data[hover] : null;

  return (
    <div>
      {hasY2 && (primaryLabel || secondaryLabel) && (
        <div className="mb-2 flex gap-4 text-xs text-sub">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent/50" /> {primaryLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-3.5 rounded-full bg-accent" /> {secondaryLabel}
          </span>
        </div>
      )}
      <div
        ref={ref}
        className="relative touch-pan-y select-none"
        style={{ height }}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} stroke="rgb(var(--line))" strokeOpacity="0.06" />
              <text x={padL - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle" className="fill-mute tnum" fontSize="11">
                {fmtY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={sx(t)} y={height - 6} textAnchor={i === 0 && xTicks.length > 1 ? 'start' : i === xTicks.length - 1 && xTicks.length > 1 ? 'end' : 'middle'} className="fill-mute" fontSize="11">
              {fmtX(t)}
            </text>
          ))}
          {goal != null && (
            <g>
              <line x1={padL} x2={width - padR} y1={sy(goal)} y2={sy(goal)} stroke="rgb(var(--sub))" strokeDasharray="3 4" strokeOpacity="0.7" />
              {goalLabel && (
                <text x={width - padR} y={sy(goal) - 6} textAnchor="end" className="fill-sub" fontSize="11">
                  {goalLabel}
                </text>
              )}
            </g>
          )}
          {area && data.length > 1 && <path d={areaPath} fill="url(#lc-fill)" />}
          {hasY2 ? (
            <>
              {data.map((d, i) => (
                <circle key={i} cx={sx(d.x)} cy={sy(d.y)} r={3} fill="rgb(var(--accent))" fillOpacity="0.45" />
              ))}
              <path d={path('y2')} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            <>
              {data.length > 1 && <path d={path('y')} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
              {showDots &&
                data.map((d, i) => <circle key={i} cx={sx(d.x)} cy={sy(d.y)} r={data.length > 30 ? 2 : 4} fill="rgb(var(--accent))" stroke="rgb(var(--surface))" strokeWidth="2" />)}
            </>
          )}
          {hp && (
            <g>
              <line x1={sx(hp.x)} x2={sx(hp.x)} y1={padT} y2={height - padB} stroke="rgb(var(--sub))" strokeOpacity="0.5" />
              <circle cx={sx(hp.x)} cy={sy(hasY2 ? hp.y2 ?? hp.y : hp.y)} r={5.5} fill="rgb(var(--accent))" stroke="rgb(var(--surface))" strokeWidth="2.5" />
            </g>
          )}
        </svg>
        {hp && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl bg-raised px-3 py-2 text-xs shadow-xl"
            style={{ left: Math.min(Math.max(sx(hp.x) - 70, 0), width - 140), width: 140, boxShadow: 'inset 0 0 0 1px rgb(var(--line) / 0.08), 0 8px 24px rgb(0 0 0 / 0.35)' }}
          >
            {tooltip ? tooltip(hp) : (
              <>
                <div className="text-mute">{fmtX(hp.x)}</div>
                <div className="font-semibold tnum text-ink">{fmtY(hp.y)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface Bar {
  key: string | number;
  label: string;
  value: number;
  /** Etiqueta del tooltip. */
  tip?: ReactNode;
  highlight?: boolean;
}

export function BarChart({ data, height = 150, fmtY, band }: { data: Bar[]; height?: number; fmtY: (v: number) => string; band?: [number, number] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 36;
  const padB = 22;
  const padT = 10;
  const max = Math.max(...data.map((d) => d.value), band?.[1] ?? 0, 1);
  const { hi, ticks } = niceTicks(0, max, 3);
  const plotW = width - padL;
  const slot = plotW / data.length;
  const bw = Math.max(4, Math.min(28, slot - 6));
  const sy = (v: number) => padT + (1 - v / hi) * (height - padT - padB);
  const labelEvery = Math.ceil(data.length / 7);
  const hb = hover != null ? data[hover] : null;

  return (
    <div ref={ref} className="relative select-none" style={{ height }} onPointerLeave={() => setHover(null)}>
      <svg width={width} height={height} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width} y1={sy(t)} y2={sy(t)} stroke="rgb(var(--line))" strokeOpacity="0.06" />
            <text x={padL - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle" className="fill-mute tnum" fontSize="11">
              {fmtY(t)}
            </text>
          </g>
        ))}
        {band && <rect x={padL} width={plotW} y={sy(band[1])} height={sy(band[0]) - sy(band[1])} fill="rgb(var(--good))" fillOpacity="0.08" />}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          const y = sy(d.value);
          const h = Math.max(0, height - padB - y);
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.key} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={height - padT - padB} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${height - padB}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${height - padB}Z`}
                  fill="rgb(var(--accent))"
                  fillOpacity={hover == null ? (d.highlight ? 1 : 0.85) : hover === i ? 1 : 0.35}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={height - 6} textAnchor="middle" className="fill-mute" fontSize="11">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hb && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-raised px-3 py-2 text-xs"
          style={{ top: 0, left: Math.min(Math.max(padL + hover! * slot + slot / 2 - 65, 0), width - 130), width: 130, boxShadow: 'inset 0 0 0 1px rgb(var(--line) / 0.08), 0 8px 24px rgb(0 0 0 / 0.35)' }}
        >
          {hb.tip ?? (
            <>
              <div className="text-mute">{hb.label}</div>
              <div className="font-semibold tnum text-ink">{fmtY(hb.value)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Barras horizontales con rango objetivo (series por músculo). */
export function RangeBars({ rows, band, max }: { rows: { label: string; value: number }[]; band: [number, number]; max: number }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = Math.min(100, (r.value / max) * 100);
        const inBand = r.value >= band[0] && r.value <= band[1];
        return (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="text-ink">{r.label}</span>
              <span className="tnum text-sub">
                {String(r.value).replace('.', ',')} <span className="text-mute">series</span>
                {inBand && <span className="ml-1.5 text-good">· en rango</span>}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-raised">
              <div className="absolute inset-y-0 rounded-full" style={{ left: `${(band[0] / max) * 100}%`, width: `${((band[1] - band[0]) / max) * 100}%`, background: 'rgb(var(--good) / 0.18)' }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Rejilla de regularidad: columnas = semanas (lunes→domingo). */
export function ConsistencyGrid({ weeks, trained, now = Date.now(), onPick }: { weeks: number; trained: Map<string, number>; now?: number; onPick?: (day: string, n: number) => void }) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);
  const cols: { key: string; n: number; future: boolean; isToday: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      col.push({ key, n: trained.get(key) ?? 0, future: dt > today, isToday: dt.getTime() === today.getTime() });
    }
    cols.push(col);
  }
  return (
    <div className="flex gap-[5px]">
      <div className="mr-1 flex flex-col justify-between py-[1px] text-[10px] leading-none text-mute">
        <span>L</span>
        <span>J</span>
        <span>D</span>
      </div>
      {cols.map((col, i) => (
        <div key={i} className="flex flex-1 flex-col gap-[5px]">
          {col.map((c) => (
            <button
              key={c.key}
              aria-label={`${c.key}: ${c.n ? `${c.n} entrenamiento(s)` : 'sin entrenamiento'}`}
              onClick={() => onPick?.(c.key, c.n)}
              className={`aspect-square w-full rounded-[4px] ${c.future ? 'opacity-0' : ''} ${c.isToday ? 'ring-1 ring-ink/60' : ''}`}
              style={{ background: c.n ? 'rgb(var(--accent))' : 'rgb(var(--raised))' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
