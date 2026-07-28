"use client";

import { useState, useMemo, useEffect } from "react";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useRouter } from "next/navigation";
import { useData } from "../data-context";
import { agruparPorPeriodo } from "@/utils/periodo";
import { MultiLineChart, Stat } from "@/components/reports/charts";
import { CenterCard } from "@/components/ui/CenterCard";
import { SwipeTabs } from "@/components/ui/SwipeTabs";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import { words, termMatches } from "@/utils/search";
import type { Movimiento } from "@/types";

// Sin selector de período de la app → fechas con año (d/m/aa).
const yy = (y: string) => (y && y.length === 4 ? y.slice(2) : y || "");
const diaLabel = (f: string) => {
  if (f.includes("-")) { const [y, m, d] = f.split("-"); return `${+d}/${+m}/${yy(y)}`; }
  const [d, m, y] = f.split("/"); return `${d}/${m}/${yy(y)}`;
};
const perLabel = (pid: string) => { const [d, m, y] = pid.split("/"); return `${d}/${m}/${yy(y)}`; };

// Fecha del movimiento a ISO YYYY-MM-DD (tolera "YYYY-MM-DD" y "D/M/YYYY").
const toISO = (f: string) => {
  if (!f) return "";
  if (f.includes("-")) return f;
  const [d, m, y] = f.split("/");
  return `${y}-${String(+m).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
};

// Clave temporal de una fecha ISO según el grano. "mes" → "YYYY-MM"; "semana" → lunes de
// esa semana ("YYYY-MM-DD"). Ambas ordenan cronológicamente como strings.
const claveMes = (iso: string) => iso.slice(0, 7);
const claveSemana = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = lunes
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
};
const mesLabel = (k: string) => { const [y, m] = k.split("-"); return `${m}/${yy(y)}`; };
const semanaLabel = (k: string) => { const [y, m, d] = k.split("-"); return `${+d}/${+m}`; };

// Búsqueda por palabra exacta: helpers compartidos con el filtro de Movimientos (utils/search).
const palabras = words;
const termMatch = termMatches;

// Color para el grupo SELECCIONADO (por orden de selección; el total va en --accent).
const SEED = ["var(--green)", "var(--yellow)", "var(--purple)", "var(--teal)", "#ff6e40", "#b388ff"];
const selPalette = (i: number) => {
  if (i < SEED.length) return SEED[i];
  const h = Math.round((i * 137.508) % 360);
  return `hsl(${h} 70% 60%)`;
};

type Modo = "comparar" | "evolucion" | "proporcion";
type Grano = "periodo" | "mes" | "semana";

export default function AnalisisPage() {
  const router = useRouter();
  const { movimientos } = useData();
  const { m: money } = useMoney();
  const t = useT();

  // Análisis es táctil de punta a punta (swipe entre modos, pills, tap para desglosar) y en
  // escritorio no se ofrece desde ningún lado. Si se llega por URL, vuelve a Reportes, donde
  // el comparador de períodos cubre esa necesidad.
  const isDesktop = useIsDesktop();
  useEffect(() => {
    if (isDesktop) router.replace("/reports");
  }, [isDesktop, router]);

  const [input, setInput] = useState("");
  const [pills, setPills] = useState<string[]>([]);
  const [modo, setModo] = useState<Modo>("comparar");
  // Progreso del swipe entre modos (∈[-1,1], <0 hacia el siguiente) para que el indicador
  // del selector acompañe el dedo, igual que en Reportes.
  const [modoDragP, setModoDragP] = useState(0);
  const [grano, setGrano] = useState<Grano>("periodo");
  // Eje de agrupación en modo Comparar. "auto" = por término buscado si hay ≥2 pills
  // (así AUSA vs AUBASA quedan separados aunque compartan categoría), si no por descripción.
  const [ejeGrupo, setEjeGrupo] = useState<"auto" | "descripcion" | "categoria" | "observacion">("auto");
  const [periodosSel, setPeriodosSel] = useState<Set<string>>(new Set());
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [openGrupo, setOpenGrupo] = useState<string | null>(null);
  const [rango, setRango] = useState<{ desde: string; hasta: string } | null>(null);
  const [rangoOpen, setRangoOpen] = useState(false);
  const [diaSel, setDiaSel] = useState<{ label: string; fecha: string; total: number; obs: { texto: string; total: number; count: number }[] } | null>(null);

  const addPill = () => {
    const v = input.trim();
    if (!v) return;
    setPills((p) => (p.some((x) => x.toLowerCase() === v.toLowerCase()) ? p : [...p, v]));
    setInput("");
  };
  // Al quitar una pill: sacarla, limpiar la selección (sus keys pueden ya no existir) y
  // borrar el input si tenía ese mismo texto sin fijar (si no, seguiría matcheando vía `terms`).
  const removePill = (v: string) => {
    setPills((p) => p.filter((x) => x !== v));
    setSeleccionados([]);
    setInput((i) => (i.trim().toLowerCase() === v.trim().toLowerCase() ? "" : i));
  };
  const toggleSel = (key: string) => setSeleccionados((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  const togglePeriodo = (pid: string) => setPeriodosSel((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const selColor = (key: string) => { const i = seleccionados.indexOf(key); return i >= 0 ? selPalette(i) : null; };

  // Solo las pills FIJADAS filtran (no el input en curso) → resultados predecibles, sin
  // "residuales" al tipear. El input tiene su propio preview (abajo) para confirmar antes de fijar.
  const terms = useMemo(() => pills, [pills]);
  const activo = terms.length > 0;

  // Preview del término que se está escribiendo: cuántos movimientos matchearía (para saber
  // que está bien escrito antes de fijarlo con Enter/+), sin alterar los resultados actuales.
  const previewCount = useMemo(() => {
    const q = input.trim();
    if (!q) return null;
    let n = 0;
    for (const m of movimientos) {
      const tw = new Set(palabras(`${m.categoria ?? ""} ${m.descripcion ?? ""} ${m.observaciones ?? ""}`));
      if (termMatch(tw, q)) n++;
    }
    return n;
  }, [input, movimientos]);

  // Movimientos que matchean los términos (OR). Rango de fechas se aplica acá si está activo.
  const matchesAll = useMemo(() => {
    if (!activo) return [];
    return movimientos.filter((m) => {
      if (rango) { const iso = toISO(m.fecha); if (iso < rango.desde || iso > rango.hasta) return false; }
      const tw = new Set(palabras(`${m.categoria ?? ""} ${m.descripcion ?? ""} ${m.observaciones ?? ""}`));
      return terms.some((term) => termMatch(tw, term));
    });
  }, [movimientos, terms, activo, rango]);

  // Períodos disponibles (con matches), reciente → viejo.
  const periodosAll = useMemo(() => {
    const orden = agruparPorPeriodo(movimientos).map((p) => p.periodoId);
    return orden.filter((pid) => matchesAll.some((m) => m.periodoId === pid));
  }, [matchesAll, movimientos]);

  // Ventana temporal: períodos elegidos (o todos). El rango de fechas ya filtró matchesAll.
  const periodos = useMemo(() => (periodosSel.size ? periodosAll.filter((p) => periodosSel.has(p)) : periodosAll), [periodosAll, periodosSel]);
  const matches = useMemo(() => {
    if (!periodosSel.size) return matchesAll;
    return matchesAll.filter((m) => periodosSel.has(m.periodoId));
  }, [matchesAll, periodosSel]);

  // Gasto total por período (para Proporción: "cuánto pesa lo buscado sobre el gasto").
  // Denominador = solo GASTOS (Gasto + compras/gastos de divisa); ingresos y Moves no cuentan.
  const ES_GASTO = new Set(["Gasto", "CompraUSD", "GastoUSD", "CompraEUR", "GastoEUR"]);
  const gastoPorPeriodo = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movimientos) {
      if (!ES_GASTO.has(m.tipo)) continue;
      map.set(m.periodoId, (map.get(m.periodoId) ?? 0) + m.monto);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos]);

  // Etiqueta de grupo de un movimiento según el eje elegido. En "auto" con ≥2 términos,
  // agrupa por el término buscado que matchea (AUSA/AUBASA separados aunque compartan
  // categoría); con 1 término cae a descripción. Los demás ejes son directos.
  const grupoLabel = (m: Movimiento): string => {
    if (ejeGrupo === "categoria") return m.categoria || "—";
    if (ejeGrupo === "observacion") return m.observaciones?.trim() || "(sin observación)";
    if (ejeGrupo === "descripcion") return m.descripcion?.trim() || m.categoria || "—";
    // auto
    if (pills.length >= 2) {
      const tw = new Set(palabras(`${m.categoria ?? ""} ${m.descripcion ?? ""} ${m.observaciones ?? ""}`));
      const hit = pills.find((p) => termMatch(tw, p));
      if (hit) return hit;
    }
    return m.descripcion?.trim() || m.categoria || "—";
  };

  // ── Agrupación de los matches según el eje ───────────────────────────────────
  const analysis = useMemo(() => {
    if (matches.length === 0) return null;
    const totalPer = new Map<string, number>();
    for (const m of matches) totalPer.set(m.periodoId, (totalPer.get(m.periodoId) ?? 0) + m.monto);

    // Agrupar por clave NORMALIZADA para que variantes del mismo texto caigan en UN grupo
    // (sin keys duplicadas en React): minúsculas + trim + colapsar espacios + sin tildes.
    // Se guarda el primer label visto como representativo para mostrar.
    const normKey = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
    const gmap = new Map<string, { label: string; movs: Movimiento[] }>();
    for (const m of matches) {
      const label = grupoLabel(m);
      const key = normKey(label);
      const g = gmap.get(key) ?? { label, movs: [] };
      g.movs.push(m); gmap.set(key, g);
    }
    const grupos = [...gmap.entries()].map(([key, { label, movs }]) => {
      const per = new Map<string, number>();
      for (const m of movs) per.set(m.periodoId, (per.get(m.periodoId) ?? 0) + m.monto);
      const dmap = new Map<string, { total: number; count: number; obs: Map<string, { total: number; count: number }> }>();
      for (const m of movs) {
        const d = dmap.get(m.fecha) ?? { total: 0, count: 0, obs: new Map() };
        d.total += m.monto; d.count++;
        const o = m.observaciones?.trim();
        if (o) { const e = d.obs.get(o) ?? { total: 0, count: 0 }; e.total += m.monto; e.count++; d.obs.set(o, e); }
        dmap.set(m.fecha, d);
      }
      const dias = [...dmap.entries()].map(([fecha, d]) => ({
        fecha, total: d.total, count: d.count,
        obs: [...d.obs.entries()].map(([texto, e]) => ({ texto, total: e.total, count: e.count })).sort((a, b) => b.total - a.total),
      })).sort((a, b) => b.fecha.localeCompare(a.fecha));
      const total = movs.reduce((s, m) => s + m.monto, 0);
      return { key, label, total, count: movs.length, avg: total / movs.length, per, dias };
    }).sort((a, b) => b.total - a.total);

    const total = matches.reduce((s, m) => s + m.monto, 0);
    const topLabel = grupos[0]?.label ?? "—";
    const topPct = total > 0 ? Math.round((grupos[0]?.total ?? 0) / total * 100) : 0;
    return { totalPer, grupos, total, topLabel, topPct };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, ejeGrupo, pills]);

  // Serie de líneas: total + grupos seleccionados, sobre la ventana de períodos.
  const chartSeries = useMemo(() => {
    if (!analysis) return [];
    const total = { key: "__total", color: "var(--accent)", width: 2.6, values: periodos.map((pid) => analysis.totalPer.get(pid) ?? 0) };
    const sel = seleccionados.map((key) => {
      const g = analysis.grupos.find((x) => x.key === key);
      if (!g) return null;
      return { key, color: selColor(key)!, values: periodos.map((pid) => g.per.get(pid) ?? 0) };
    }).filter(Boolean) as { key: string; color: string; values: number[] }[];
    return [total, ...sel];
  }, [analysis, seleccionados, periodos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Evolución: total de lo buscado a lo largo del tiempo, re-agrupado según el grano ──
  // "periodo" usa los períodos de sueldo; "mes"/"semana" re-agrupan los matches por fecha.
  const evolucion = useMemo(() => {
    if (!analysis) return null;

    // Puntos reciente → viejo: {key, label, total}. Según grano.
    let recientes: { key: string; label: string; total: number }[];
    if (grano === "periodo") {
      recientes = periodos.map((pid) => ({ key: pid, label: perLabel(pid), total: analysis.totalPer.get(pid) ?? 0 }));
    } else {
      const claveDe = grano === "mes" ? claveMes : claveSemana;
      const labelDe = grano === "mes" ? mesLabel : semanaLabel;
      const map = new Map<string, number>();
      for (const m of matches) {
        const iso = toISO(m.fecha);
        if (!iso) continue;
        const k = claveDe(iso);
        map.set(k, (map.get(k) ?? 0) + m.monto);
      }
      recientes = [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0])) // reciente → viejo
        .map(([key, total]) => ({ key, label: labelDe(key), total }));
    }

    // Tendencia: primero vs último con gasto, en orden cronológico (viejo → nuevo).
    const chron = [...recientes].reverse();
    const conGasto = chron.filter((p) => p.total > 0);
    let tendencia: number | null = null;
    if (conGasto.length >= 2) {
      const first = conGasto[0].total, last = conGasto[conGasto.length - 1].total;
      tendencia = first > 0 ? Math.round((last - first) / first * 100) : null;
    }
    // Detalle reciente → viejo con Δ vs el punto anterior (más viejo).
    const detalle = recientes.map((p, i) => {
      const prev = recientes[i + 1];
      const delta = prev && prev.total > 0 ? Math.round((p.total - prev.total) / prev.total * 100) : null;
      return { key: p.key, label: p.label, total: p.total, delta };
    });
    // Gráfico: SIEMPRE el más reciente a la IZQUIERDA (regla de la app) → usa `recientes`.
    return { tendencia, detalle, labels: recientes.map((p) => p.label), valores: recientes.map((p) => p.total) };
  }, [analysis, periodos, matches, grano]);

  // ── Proporción: lo buscado como % del total de cada período ───────────────────
  const proporcion = useMemo(() => {
    if (!analysis) return null;
    const porPeriodo = periodos.map((pid) => {
      const parte = analysis.totalPer.get(pid) ?? 0;
      const total = gastoPorPeriodo.get(pid) ?? 0;
      return { pid, parte, total, pct: total > 0 ? (parte / total) * 100 : 0 };
    });
    const parteTot = porPeriodo.reduce((s, p) => s + p.parte, 0);
    const totalTot = porPeriodo.reduce((s, p) => s + p.total, 0);
    const pctGlobal = totalTot > 0 ? (parteTot / totalTot) * 100 : 0;
    return { porPeriodo, parteTot, restoTot: Math.max(0, totalTot - parteTot), pctGlobal };
  }, [analysis, periodos, gastoPorPeriodo]);

  const MODOS: { id: Modo; label: string }[] = [
    { id: "comparar", label: t.analyzeModeCompare },
    { id: "evolucion", label: t.analyzeModeEvolution },
    { id: "proporcion", label: t.analyzeModeShare },
  ];

  return (
    <div className="page fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <button onClick={() => router.push("/reports")} aria-label={t.back} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 4, display: "flex", marginLeft: -4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{t.analyzeTitle}</h1>
      </div>

      {pills.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {pills.map((p) => (
            <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 13, fontWeight: 600 }}>
              {p}
              <button type="button" onClick={() => removePill(p)} aria-label={t.remove} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <input
          className="input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPill(); } }}
          placeholder={t.analyzeSearchPlaceholder} enterKeyHint="search" style={{ paddingRight: 46 }}
        />
        <button type="button" onClick={addPill} disabled={!input.trim()} aria-label={t.add} style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: 9, border: "none",
          background: input.trim() ? "var(--accent)" : "var(--surface-alt)", color: input.trim() ? "#fff" : "var(--muted)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "default",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
      {/* Preview del término tipeado: confirma que existe/está bien escrito antes de fijarlo. */}
      {previewCount !== null && (
        <div style={{ margin: "-6px 4px 14px", fontSize: 11.5, color: previewCount > 0 ? "var(--green)" : "var(--muted)" }}>
          {previewCount > 0 ? t.analyzePreviewMatches(previewCount) : t.analyzePreviewNone}
        </div>
      )}

      {!activo ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.analyzeEmpty}</div>
      ) : !analysis ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.analyzeNoResults}</div>
      ) : (
        <>
          {/* Selector de modo con indicador deslizante: el fondo acompaña la selección con
              transición (como las pills de Reportes) en vez de saltar de golpe. */}
          <div className="subtabs" style={{ position: "relative", marginBottom: 14 }}>
            <div aria-hidden style={{
              position: "absolute", top: 4, bottom: 4, left: 4,
              width: `calc((100% - 8px) / ${MODOS.length})`,
              // Base en el modo activo, desplazado por el progreso del swipe (sigue el dedo).
              transform: `translateX(${(MODOS.findIndex((mo) => mo.id === modo) - modoDragP) * 100}%)`,
              transition: modoDragP !== 0 ? "none" : "transform .24s cubic-bezier(.2,.8,.2,1)",
              borderRadius: 999, background: "var(--accent-dim)", border: "1px solid var(--accent)",
            }} />
            {MODOS.map((mo) => (
              <button key={mo.id} onClick={() => setModo(mo.id)} className="subtab"
                style={{ position: "relative", zIndex: 1, background: "transparent", color: modo === mo.id ? "var(--accent)" : "var(--muted)" }}>
                {mo.label}
              </button>
            ))}
          </div>

          {/* Selector de tiempo: períodos (multi) + botón Rango. En Evolución, además grano. */}
          {periodosAll.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {rango ? `${diaLabel(rango.desde)} – ${diaLabel(rango.hasta)}` : t.analyzePeriodsHint}
                </span>
                {(periodosSel.size > 0 || seleccionados.length > 0 || rango) && (
                  <button type="button" onClick={() => { setPeriodosSel(new Set()); setSeleccionados([]); setRango(null); }} style={{
                    flexShrink: 0, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "2px 4px",
                  }}>{t.analyzeClearSel}</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                <button type="button" onClick={() => setRangoOpen(true)} className="pill" style={{
                  flexShrink: 0, borderStyle: "dashed", borderColor: rango ? "var(--accent)" : "var(--border)", background: rango ? "var(--accent-dim)" : "transparent", color: rango ? "var(--accent)" : "var(--text)",
                }}>📅 {t.analyzeRange}</button>
                {periodosAll.map((pid) => {
                  const on = periodosSel.has(pid);
                  return (
                    <button key={pid} type="button" onClick={() => togglePeriodo(pid)} className="pill" style={{
                      flexShrink: 0, borderColor: on ? "var(--accent)" : "var(--border)", background: on ? "var(--accent-dim)" : "transparent", color: on ? "var(--accent)" : "var(--muted)",
                    }}>{perLabel(pid)}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Swipe entre los 3 modos (como las tabs de Reportes): el contenido se desliza y
              el indicador del selector sigue el dedo (onProgress → modoDragP). */}
          <SwipeTabs
            index={MODOS.findIndex((mo) => mo.id === modo)}
            count={MODOS.length}
            onIndexChange={(next) => setModo(MODOS[next].id)}
            onProgress={setModoDragP}
          >
            {/* ══ 0 · COMPARAR ══ */}
            {(() => {
              // Suma de los grupos seleccionados (los marcados con color), para el stat.
              const sumaSel = seleccionados.reduce((s, key) => s + (analysis.grupos.find((g) => g.key === key)?.total ?? 0), 0);
              const haySel = seleccionados.length > 0;
              return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <Stat label={t.analyzeTotal} value={money(analysis.total)} color="var(--accent)" dimVar="var(--accent-dim)" />
                {haySel
                  ? <Stat label={t.analyzeSelectedSum(seleccionados.length)} value={money(sumaSel)} color="var(--green)" dimVar="var(--green-dim)" sub={t.analyzeSelectedShare(analysis.total > 0 ? Math.round(sumaSel / analysis.total * 100) : 0)} />
                  : <Stat label={t.analyzeTopGroup} value={analysis.topLabel} sub={t.analyzeTopShare(analysis.topPct)} />}
              </div>

              {periodos.length > 1 && chartSeries.length > 1 && (
                <div className="soft" style={{ padding: "14px 12px", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, marginLeft: 4 }}>{t.analyzeEvolution}</div>
                  <MultiLineChart labels={periodos.map(perLabel)} series={chartSeries} />
                </div>
              )}
              {/* Eje de agrupación: por qué campo se arman los grupos a comparar. */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{t.analyzeGroupBy}</span>
                {([["auto", t.analyzeAxisAuto], ["descripcion", t.analyzeAxisDesc], ["categoria", t.analyzeAxisCat], ["observacion", t.analyzeAxisObs]] as const).map(([id, label]) => (
                  // Cambiar el eje re-arma los grupos con keys distintas → limpiar la selección
                  // (si no, las keys viejas no matchean y la suma quedaría en $0).
                  <button key={id} type="button" onClick={() => { setEjeGrupo(id); setSeleccionados([]); }} className="pill" style={{
                    flexShrink: 0, fontSize: 11, padding: "4px 11px",
                    borderColor: ejeGrupo === id ? "var(--accent)" : "var(--border)", background: ejeGrupo === id ? "var(--accent-dim)" : "transparent", color: ejeGrupo === id ? "var(--accent)" : "var(--muted)",
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", margin: "0 4px 12px" }}>{t.analyzeCompareHint}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.grupos.map((g) => {
                  const c = selColor(g.key);
                  const sel = c != null;
                  const pctDelMayor = analysis.grupos[0].total > 0 ? Math.round(g.total / analysis.grupos[0].total * 100) : 0;
                  const esMayor = g.key === analysis.grupos[0].key;
                  const delta = analysis.grupos[0].total > 0 ? Math.round((g.total - analysis.grupos[0].total) / analysis.grupos[0].total * 100) : 0;
                  const abierto = openGrupo === g.key;
                  return (
                    <div key={g.key} className="card" style={{ padding: 0, overflow: "hidden", border: `1px solid ${sel ? c : "var(--border)"}` }}>
                      <div style={{ display: "flex", alignItems: "stretch" }}>
                        <button onClick={() => toggleSel(g.key)} aria-pressed={sel} style={{
                          flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 10, padding: "12px 4px 12px 14px", textAlign: "left",
                        }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: sel ? c! : "var(--muted)", opacity: sel ? 1 : 0.45 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.analyzeTimes(g.count)} · {t.analyzeAvg(money(g.avg))}</div>
                            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-alt)", overflow: "hidden", marginTop: 7 }}>
                              <div style={{ height: "100%", borderRadius: 3, width: `${pctDelMayor}%`, background: sel ? c! : "var(--border-hi)" }} />
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{money(g.total)}</div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--font-mono)", marginTop: 1, color: esMayor ? "var(--muted)" : "var(--green)" }}>
                              {esMayor ? "100%" : `${delta}%`}
                            </div>
                          </div>
                        </button>
                        <button onClick={() => setOpenGrupo(abierto ? null : g.key)} aria-label={t.analyzeDetail} style={{
                          background: "none", border: "none", borderLeft: "1px solid var(--faint)", cursor: "pointer",
                          padding: "0 12px", color: "var(--muted)", display: "flex", alignItems: "center",
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                      </div>
                      {abierto && (
                        <div style={{ borderTop: "1px solid var(--faint)", maxHeight: 300, overflowY: "auto" }}>
                          {g.dias.map((d, i) => {
                            const tieneObs = d.obs.length > 0;
                            const row = (
                              <>
                                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                                  {diaLabel(d.fecha)}{d.count > 1 && <span style={{ opacity: 0.7 }}>×{d.count}</span>}
                                  {tieneObs && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                  )}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{money(d.total)}</span>
                              </>
                            );
                            const st: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 14px 9px 32px", borderTop: i > 0 ? "1px solid var(--faint)" : "none", width: "100%" };
                            return tieneObs ? (
                              <button key={i} onClick={() => setDiaSel({ label: g.label, fecha: d.fecha, total: d.total, obs: d.obs })} style={{ ...st, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>{row}</button>
                            ) : (
                              <div key={i} style={st}>{row}</div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
              );
            })()}

            {/* ══ 1 · EVOLUCIÓN ══ */}
            {evolucion ? (
            <>
              {/* Grano temporal */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", scrollbarWidth: "none" }}>
                {(["periodo", "mes", "semana"] as Grano[]).map((gr) => (
                  <button key={gr} type="button" onClick={() => setGrano(gr)} className="pill" style={{
                    flexShrink: 0, borderColor: grano === gr ? "var(--accent)" : "var(--border)", background: grano === gr ? "var(--accent-dim)" : "transparent", color: grano === gr ? "var(--accent)" : "var(--muted)",
                  }}>{gr === "periodo" ? t.analyzeGrainPeriod : gr === "mes" ? t.analyzeGrainMonth : t.analyzeGrainWeek}</button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <Stat label={t.analyzeTotal} value={money(analysis.total)} color="var(--accent)" dimVar="var(--accent-dim)" />
                <Stat label={t.analyzeTrend} value={evolucion.tendencia == null ? "—" : `${evolucion.tendencia > 0 ? "↑" : evolucion.tendencia < 0 ? "↓" : ""} ${Math.abs(evolucion.tendencia)}%`}
                  color={evolucion.tendencia == null ? undefined : evolucion.tendencia > 0 ? "var(--red)" : "var(--green)"} sub={t.analyzeTrendSub} />
              </div>

              {evolucion.valores.length > 1 && (
                <div className="soft" style={{ padding: "14px 12px", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, marginLeft: 4 }}>{t.analyzeEvolution}</div>
                  <MultiLineChart labels={evolucion.labels} series={[{ key: "__total", color: "var(--accent)", width: 2.6, values: evolucion.valores }]} />
                </div>
              )}

              <div style={{ fontSize: 11, color: "var(--muted)", margin: "0 4px 8px" }}>{t.analyzeEvolutionHint}</div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                {evolucion.detalle.map((d, i) => (
                  <div key={d.key} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 11, alignItems: "center", padding: "11px 14px", borderTop: i > 0 ? "1px solid var(--faint)" : "none" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{d.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>{money(d.total)}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--font-mono)", color: d.delta == null ? "var(--muted)" : d.delta > 0 ? "var(--red)" : d.delta < 0 ? "var(--green)" : "var(--muted)" }}>
                      {d.delta == null ? "—" : `${d.delta > 0 ? "▲ +" : d.delta < 0 ? "▼ " : ""}${d.delta}%`}
                    </span>
                  </div>
                ))}
              </div>
            </>
            ) : <div />}

            {/* ══ 2 · PROPORCIÓN ══ */}
            {proporcion ? (
            <>
              <div className="soft" style={{ padding: "16px 14px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.analyzeShareWeighs}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 800, color: "var(--yellow)" }}>{proporcion.pctGlobal.toFixed(1)}%</span>
                </div>
                <div style={{ display: "flex", height: 30, borderRadius: 8, overflow: "hidden", margin: "6px 0 12px" }}>
                  <div style={{ width: `${proporcion.pctGlobal}%`, background: "var(--yellow)" }} />
                  <div style={{ flex: 1, background: "var(--surface-alt)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center", fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--yellow)" }} />
                    <span>{t.analyzeShareSearched}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--yellow)", minWidth: 44, textAlign: "right" }}>{proporcion.pctGlobal.toFixed(1)}%</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11.5, minWidth: 66, textAlign: "right" }}>{money(proporcion.parteTot)}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center", fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--surface-alt)", border: "1px solid var(--border)" }} />
                    <span style={{ color: "var(--muted)" }}>{t.analyzeShareRest}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--muted)", minWidth: 44, textAlign: "right" }}>{(100 - proporcion.pctGlobal).toFixed(1)}%</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11.5, minWidth: 66, textAlign: "right" }}>{money(proporcion.restoTot)}</span>
                  </div>
                </div>
              </div>

              {proporcion.porPeriodo.length > 1 && (
                <div className="soft" style={{ padding: "14px 12px 10px" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, marginLeft: 4 }}>{t.analyzeShareOverTime}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end", overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                    {proporcion.porPeriodo.map((p) => (
                      <div key={p.pid} style={{ flexShrink: 0, textAlign: "center", minWidth: 44 }}>
                        <div style={{ height: 90, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "var(--surface-alt)", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ height: `${Math.max(3, p.pct)}%`, background: "var(--yellow)" }} />
                        </div>
                        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, marginTop: 5 }}>{p.pct.toFixed(0)}%</div>
                        <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{perLabel(p.pid)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
            ) : <div />}
          </SwipeTabs>
        </>
      )}

      {/* Rango de fechas */}
      <CenterCard open={rangoOpen} onClose={() => setRangoOpen(false)} title={t.analyzeRange}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div className="label">{t.analyzeFrom}</div>
            <input className="input" type="date" defaultValue={rango?.desde ?? ""} id="an-desde" />
          </div>
          <div>
            <div className="label">{t.analyzeTo}</div>
            <input className="input" type="date" defaultValue={rango?.hasta ?? ""} id="an-hasta" />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => { setRango(null); setRangoOpen(false); }} className="pill" style={{ flex: 1, borderColor: "var(--border)", color: "var(--muted)" }}>{t.analyzeClearSel}</button>
            <button type="button" onClick={() => {
              const d = (document.getElementById("an-desde") as HTMLInputElement)?.value;
              const h = (document.getElementById("an-hasta") as HTMLInputElement)?.value;
              if (d && h) { setRango({ desde: d <= h ? d : h, hasta: d <= h ? h : d }); setPeriodosSel(new Set()); }
              setRangoOpen(false);
            }} style={{ flex: 1, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 999, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t.analyzeApply}</button>
          </div>
        </div>
      </CenterCard>

      {/* Detalle de observaciones del día */}
      <CenterCard open={!!diaSel} onClose={() => setDiaSel(null)} title={diaSel ? `${diaSel.label} · ${diaLabel(diaSel.fecha)}` : ""}>
        {diaSel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {diaSel.obs.map((o, i) => (
              <div key={i} className="row" style={{ padding: "10px 0", borderBottom: i < diaSel.obs.length - 1 ? "1px solid var(--faint)" : "none", gap: 10 }}>
                <span style={{ fontSize: 13, minWidth: 0, flex: 1 }}>
                  {o.texto}{o.count > 1 && <span style={{ color: "var(--muted)", marginLeft: 6 }}>×{o.count}</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{money(o.total)}</span>
              </div>
            ))}
            <div className="row" style={{ padding: "10px 0 2px", marginTop: 4, borderTop: "1px solid var(--border)", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{t.analyzeTotal}</span>
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{money(diaSel.total)}</span>
            </div>
          </div>
        )}
      </CenterCard>
    </div>
  );
}
