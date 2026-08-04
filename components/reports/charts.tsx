import { formatARS } from "@/utils/periodo";
import { MASK } from "@/hooks/useHideValues";
import { abbr, shortPer } from "./format";

export function Bar({ nombre, monto, pct, color = "var(--accent)", oculto, presupuesto, onClick }: { nombre: string; monto: number; pct: number; color?: string; oculto?: boolean; presupuesto?: number; onClick?: () => void }) {
  const hasBudget = !!presupuesto && presupuesto > 0;
  const usedPct = hasBudget ? Math.round((monto / presupuesto!) * 100) : 0;
  const budgetColor = usedPct > 100 ? "var(--red)" : usedPct > 80 ? "var(--yellow)" : "var(--green)";
  const barColor = hasBudget ? budgetColor : color;
  const barWidth = hasBudget ? Math.min(usedPct, 100) : Math.min(pct, 100);
  // En modo presupuesto los números muestran el delta: cuánto se pasó (+) o falta (−).
  const deltaMonto = monto - (presupuesto ?? 0);
  const deltaPct = usedPct - 100;
  return (
    <div style={{ marginBottom: 13, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 1, gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre}</span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", whiteSpace: "nowrap" }}>
          {hasBudget ? (
            oculto ? MASK : <>{deltaMonto >= 0 ? "+" : "−"}{formatARS(Math.abs(deltaMonto))} <span style={{ fontSize: 11, color: budgetColor, fontWeight: 600 }}>{deltaPct >= 0 ? "+" : "−"}{Math.abs(deltaPct)}%</span></>
          ) : (
            <>{oculto ? MASK : formatARS(monto)} <span style={{ color: "var(--muted)", fontSize: 11 }}>{pct}%</span></>
          )}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
        <div style={{ flex: 1, height: 8, background: "var(--faint)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 999, transition: "width 0.5s ease", width: `${barWidth}%`, background: barColor }} />
        </div>
        {hasBudget && !oculto && (
          <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", flexShrink: 0, fontWeight: 600 }}>{abbr(presupuesto!)}</span>
        )}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, color, danger, dimVar }: { label: string; value: string; sub?: string; color?: string; danger?: boolean; dimVar?: string }) {
  const cardStyle = danger
    ? { borderColor: "var(--red)66", background: "linear-gradient(135deg, var(--surface), var(--red-dim, var(--surface-alt)))" }
    : dimVar
    ? { background: `linear-gradient(135deg, var(--surface), ${dimVar})`, ...(color ? { borderColor: `${color}22` } : {}) }
    : {};
  return (
    <div className="soft" style={{ padding: 15, ...cardStyle }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? "var(--text)", fontFamily: "var(--font-mono)", lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function DonutChart({ data, size = 80, strokeWidth = 13, selected, onSelect }: {
  data: { value: number; color: string; key: string; label: string }[];
  size?: number; strokeWidth?: number;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const sel = selected ? data.find(d => d.key === selected) : null;
  const ariaSummary = data.filter(d => d.value > 0)
    .map(d => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(", ");
  // Offset acumulado por porción, con reduce (sin mutar una variable local durante el
  // render): cada slice arranca donde terminó la anterior. El acumulado va DENTRO del par
  // que devuelve el reduce (no en una variable externa), así no hay reasignación fuera de él.
  const { slices } = data.filter(d => d.value > 0).reduce<{
    slices: { dash: number; offset: number; color: string; key: string }[];
    acumulado: number;
  }>(
    (out, { value, color, key }) => {
      const dash = (value / total) * c;
      return { slices: [...out.slices, { dash, offset: -out.acumulado, color, key }], acumulado: out.acumulado + dash };
    },
    { slices: [], acumulado: 0 }
  );
  return (
    <div role="img" aria-label={ariaSummary} style={{ position: "relative", width: size, height: size, flexShrink: 0 }} onClick={() => onSelect?.(null)}>
      <svg width={size} height={size} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        {slices.map(({ dash, offset, color, key }, i) => {
          return <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={offset}
            opacity={selected && selected !== key ? 0.2 : 1}
            style={{ cursor: "pointer", transition: "opacity 0.2s" }}
            onClick={(e) => { e.stopPropagation(); onSelect?.(selected === key ? null : key); }} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 1 }}>
        {sel ? (
          <div style={{ fontSize: 18, fontWeight: 700, color: sel.color, fontFamily: "var(--font-mono)", lineHeight: 1 }}>{Math.round((sel.value / total) * 100)}%</div>
        ) : null}
      </div>
    </div>
  );
}

// Mini-stat compacto, fondo neutro, color sólo en el número.
export function VBars({ data, max, oculto, refFrac, onBarClick }: { data: { label: string; value: number; color: string; hi?: boolean; best?: boolean; worst?: boolean; valueLabel?: string; periodoId?: string }[]; max: number; oculto?: boolean; refFrac?: number; onBarClick?: (periodoId: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
      {data.map((d, i) => {
        const clickable = !!(onBarClick && d.periodoId);
        const Comp: "button" | "div" = clickable ? "button" : "div";
        return (
        <Comp key={i} type={clickable ? "button" : undefined}
          onClick={() => d.periodoId && onBarClick?.(d.periodoId)}
          aria-label={clickable ? `${shortPer(d.label)}: ${oculto ? "" : (d.valueLabel ?? abbr(d.value))}` : undefined}
          style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: clickable ? "pointer" : "default", background: "transparent", border: "none", padding: 0, font: "inherit" }}>
          <div style={{ fontSize: 8, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "•" : (d.valueLabel ?? abbr(d.value))}</div>
          <div style={{ height: 96, width: 20, background: "var(--faint)", borderRadius: 7, display: "flex", alignItems: "flex-end", overflow: "hidden", position: "relative" }}>
            {refFrac != null && <div style={{ position: "absolute", left: 0, right: 0, bottom: `${Math.round(refFrac * 96)}px`, height: 1, background: "var(--text)44", zIndex: 1 }} />}
            <div style={{ width: "100%", height: `${max > 0 ? Math.round((d.value / max) * 100) : 0}%`, background: d.color, borderRadius: 7, transition: "height .5s ease" }} />
          </div>
          <div style={{ fontSize: 8, fontWeight: (d.best || d.worst || d.hi) ? 700 : 400, color: d.best ? "var(--green)" : d.worst ? "var(--red)" : d.hi ? "var(--accent)" : "var(--muted)" }}>{shortPer(d.label)}</div>
        </Comp>
        );
      })}
    </div>
  );
}

export type DotDatum = { label: string; value: number; color: string; hi?: boolean; periodoId?: string };

// Gráfico de puntos conectados por una línea de tendencia, con escala automática al
// rango de datos. Soporta una línea de referencia (refValue: 0 para inflación, 100
// para gasto/sueldo) y una segunda serie opcional (series2, p.ej. IPC país).
export function DotChart({ data, refValue, series2, series2Color, signed, format, onPointClick }: {
  data: DotDatum[];
  refValue?: number;
  series2?: (number | null)[];
  series2Color?: string;
  signed?: boolean;
  format?: (v: number) => string;
  onPointClick?: (periodoId: string) => void;
}) {
  const topPad = 16, botPad = 16, chartH = 92, PX = 46;
  const s2vals = (series2 ?? []).filter((v): v is number => v != null);
  const all = [...data.map((d) => d.value), ...(refValue != null ? [refValue] : []), ...s2vals];
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.18; min -= pad; max += pad;
  const W = Math.max(data.length * PX, PX);
  const totalH = topPad + chartH + botPad;
  const y = (v: number) => topPad + chartH - ((v - min) / (max - min)) * chartH;
  const fmt = format ?? ((v: number) => `${signed && v >= 0 ? "+" : ""}${v}%`);
  const pts = data.map((d, i) => ({ x: i * PX + PX / 2, y: y(d.value), d }));
  const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const s2pts = series2 ? series2.map((v, i) => v == null ? null : `${i * PX + PX / 2},${y(v)}`).filter(Boolean).join(" ") : "";
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      <svg width={W} height={totalH} style={{ display: "block" }}>
        {refValue != null && <line x1={0} x2={W} y1={y(refValue)} y2={y(refValue)} style={{ stroke: "var(--border-hi)" }} strokeWidth={1} strokeDasharray="3 3" />}
        {s2pts && <polyline points={s2pts} fill="none" style={{ stroke: series2Color ?? "var(--accent)" }} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.85} />}
        {pts.length > 1 && <polyline points={linePts} fill="none" style={{ stroke: "var(--border-hi)" }} strokeWidth={1.5} opacity={0.45} />}
        {series2 && pts.map((p, i) => { const v = series2[i]; return v == null ? null : <circle key={`s2-${i}`} cx={p.x} cy={y(v)} r={2.5} style={{ fill: series2Color ?? "var(--accent)" }} />; })}
        {pts.map((p, i) => {
          const clickable = !!(onPointClick && p.d.periodoId);
          return (
            <g key={i} onClick={() => p.d.periodoId && onPointClick?.(p.d.periodoId)} style={{ cursor: clickable ? "pointer" : "default" }}>
              <rect x={p.x - PX / 2} y={0} width={PX} height={totalH} fill="transparent" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" style={{ fill: "var(--muted)" }}>{fmt(p.d.value)}</text>
              <circle cx={p.x} cy={p.y} r={5} style={{ fill: p.d.color, stroke: "var(--surface)" }} strokeWidth={1.5} />
              <text x={p.x} y={totalH - 4} textAnchor="middle" fontSize={8} fontWeight={p.d.hi ? 700 : 400} style={{ fill: p.d.hi ? "var(--accent)" : "var(--muted)" }}>{p.d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Gráfico de área (línea rellena), escala automática al rango de datos. Usado para días.
export function AreaChart({ data, onPointClick }: { data: { label: string; value: number; color: string; hi?: boolean; valueLabel?: string; periodoId?: string }[]; onPointClick?: (periodoId: string) => void }) {
  const topPad = 16, botPad = 16, chartH = 92, PX = 46;
  let min = Math.min(...data.map((d) => d.value)), max = Math.max(...data.map((d) => d.value));
  if (min === max) { min -= 1; max += 1; }
  const padv = (max - min) * 0.18; min -= padv; max += padv;
  const W = Math.max(data.length * PX, PX);
  const totalH = topPad + chartH + botPad;
  const baseY = topPad + chartH;
  const y = (v: number) => topPad + chartH - ((v - min) / (max - min)) * chartH;
  const pts = data.map((d, i) => ({ x: i * PX + PX / 2, y: y(d.value), d }));
  const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPts = pts.length ? `${pts[0].x},${baseY} ${linePts} ${pts[pts.length - 1].x},${baseY}` : "";
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      <svg width={W} height={totalH} style={{ display: "block" }}>
        {pts.length > 0 && <polygon points={areaPts} style={{ fill: "var(--accent)" }} opacity={0.14} />}
        {pts.length > 1 && <polyline points={linePts} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2} />}
        {pts.map((p, i) => {
          const clickable = !!(onPointClick && p.d.periodoId);
          return (
            <g key={i} onClick={() => p.d.periodoId && onPointClick?.(p.d.periodoId)} style={{ cursor: clickable ? "pointer" : "default" }}>
              <rect x={p.x - PX / 2} y={0} width={PX} height={totalH} fill="transparent" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" style={{ fill: "var(--muted)" }}>{p.d.valueLabel ?? p.d.value}</text>
              <circle cx={p.x} cy={p.y} r={4} style={{ fill: p.d.color, stroke: "var(--surface)" }} strokeWidth={1.5} />
              <text x={p.x} y={totalH - 4} textAnchor="middle" fontSize={8} fontWeight={p.d.hi ? 700 : 400} style={{ fill: p.d.hi ? "var(--accent)" : "var(--muted)" }}>{p.d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// N líneas sobre el mismo eje de períodos (para comparar la evolución de varios grupos
// a la vez). `labels` = etiquetas del eje X (reciente a la izquierda); cada serie trae
// sus valores alineados a esos labels (0 donde no hay dato). Escala en Y desde 0.
export function MultiLineChart({ labels, series }: {
  labels: string[];
  series: { key: string; color: string; values: number[]; width?: number }[];
}) {
  const topPad = 14, botPad = 16, chartH = 110, PX = 48;
  const all = series.flatMap((s) => s.values);
  const min = 0;
  let max = Math.max(1, ...all);
  max += (max - min) * 0.12;
  const W = Math.max(labels.length * PX, PX);
  const totalH = topPad + chartH + botPad;
  const x = (i: number) => i * PX + PX / 2;
  const y = (v: number) => topPad + chartH - ((v - min) / (max - min)) * chartH;
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      <svg width={W} height={totalH} style={{ display: "block" }}>
        {series.map((s) => (
          <g key={s.key}>
            {s.values.length > 1 && <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" style={{ stroke: s.color }} strokeWidth={s.width ?? 2} strokeLinecap="round" strokeLinejoin="round" />}
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.5} style={{ fill: s.color }} />)}
          </g>
        ))}
        {labels.map((lb, i) => (
          <text key={i} x={x(i)} y={totalH - 4} textAnchor="middle" fontSize={8} style={{ fill: "var(--muted)" }}>{lb}</text>
        ))}
      </svg>
    </div>
  );
}

// Dos líneas acumuladas (serie A = vos, serie B = país) para comparar la inflación
// acumulada propia vs la del país a lo largo de los períodos.
export function TwoLineChart({ points, colorA, onPointClick }: {
  points: { label: string; a: number; b: number | null; hi?: boolean; periodoId?: string }[];
  colorA: string;
  onPointClick?: (periodoId: string) => void;
}) {
  const topPad = 16, botPad = 16, chartH = 100, PX = 46;
  const bs = points.map((p) => p.b).filter((v): v is number => v != null);
  const all = [0, ...points.map((p) => p.a), ...bs];
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;
  const W = Math.max(points.length * PX, PX);
  const totalH = topPad + chartH + botPad;
  const y = (v: number) => topPad + chartH - ((v - min) / (max - min)) * chartH;
  const aPts = points.map((p, i) => ({ x: i * PX + PX / 2, y: y(p.a), p }));
  const aLine = aPts.map((p) => `${p.x},${p.y}`).join(" ");
  const bLine = points.map((p, i) => p.b == null ? null : `${i * PX + PX / 2},${y(p.b)}`).filter(Boolean).join(" ");
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      <svg width={W} height={totalH} style={{ display: "block" }}>
        {min < 0 && max > 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} style={{ stroke: "var(--border-hi)" }} strokeWidth={1} strokeDasharray="3 3" />}
        {bLine && <polyline points={bLine} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2} strokeDasharray="4 3" />}
        {aPts.length > 1 && <polyline points={aLine} fill="none" style={{ stroke: colorA }} strokeWidth={2} />}
        {points.map((p, i) => p.b == null ? null : <circle key={`b-${i}`} cx={i * PX + PX / 2} cy={y(p.b)} r={3} style={{ fill: "var(--accent)" }} />)}
        {aPts.map((p, i) => {
          const clickable = !!(onPointClick && p.p.periodoId);
          return (
            <g key={i} onClick={() => p.p.periodoId && onPointClick?.(p.p.periodoId)} style={{ cursor: clickable ? "pointer" : "default" }}>
              <rect x={p.x - PX / 2} y={0} width={PX} height={totalH} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={4} style={{ fill: colorA, stroke: "var(--surface)" }} strokeWidth={1.5} />
              <text x={p.x} y={totalH - 4} textAnchor="middle" fontSize={8} fontWeight={p.p.hi ? 700 : 400} style={{ fill: p.p.hi ? "var(--accent)" : "var(--muted)" }}>{p.p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
