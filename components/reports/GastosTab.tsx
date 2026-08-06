"use client";

import type { Dispatch, SetStateAction } from "react";
import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { MiniStat } from "@/components/ui/MiniStat";
import { Bar } from "@/components/reports/charts";
import { abbr, shortPer, colorPct, colorZ, deltaMag, deltaColor } from "@/components/reports/format";
import { formatARS } from "@/utils/periodo";
import type { PeriodoResumen } from "@/utils/periodo";
import type { ConfigUsuario } from "@/types";

type KpiInfo = { title: string; value: string; explain: string; color?: string };
type Cat = { categoria: string; monto: number; pct: number };
type Desc = { nombre: string; monto: number; pct: number };

interface Props {
  periodo: PeriodoResumen;
  periodos: PeriodoResumen[];
  activos: string[];
  anterior?: PeriodoResumen;
  esPeriodoVigente: boolean;
  ritmo: { enCurso: boolean; gastadoPorDia: number; proyeccionCierre: number } | null;
  tendenciaGasto: number | null;
  avgHistorico: number;
  promPorMov: number | null;
  comp: { categoria: string; actual: number; anterior: number; deltaPct: number | null }[];
  anomalias: { categoria: string; actual: number; promedio: number; deltaPct: number }[];
  descs: Desc[];
  descsCompra: Set<string>;
  catsConPresu: Cat[];
  catsEditables: string[];
  esCatCompra: (cat: string) => boolean;
  presupuesto: Record<string, number> | null;
  presupuestoEfectivo: Record<string, number> | null;
  showBudget: boolean;
  config: ConfigUsuario | null;
  setShowBudget: Dispatch<SetStateAction<boolean>>;
  setEditingBudget: Dispatch<SetStateAction<Record<string, string>>>;
  setModalBudget: (v: boolean) => void;
  setCatModal: (v: string | null) => void;
  /** Abre el detalle de una categoría en el período anterior (desde la comparativa). */
  setCatAnteriorModal: (v: string | null) => void;
  setModalTop: (v: "gastos" | "descs" | "movcat" | null) => void;
  setKpiInfo: (v: KpiInfo) => void;
}

// Subtab "Gastos" de Reportes: hero del gastado, mini-stats (tendencia, gasto real,
// ritmo, prom. por mov), categorías con presupuesto y comparativa vs anterior.
export function GastosTab({
  periodo, periodos, activos, anterior, esPeriodoVigente, ritmo, tendenciaGasto, avgHistorico,
  promPorMov, comp, anomalias, descs, descsCompra, catsConPresu, catsEditables,
  esCatCompra, presupuesto, presupuestoEfectivo, showBudget, config,
  setShowBudget, setEditingBudget, setModalBudget, setCatModal, setCatAnteriorModal, setModalTop, setKpiInfo,
}: Props) {
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const reportOn = (_id: string) => true;

  return (
    <>
      {/* Hero: Gastado */}
      {reportOn("gastos_kpis") && (() => {
        const pctColor = colorPct(periodo.pct);
        return (
          <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--red-dim))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.spent}</span>
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t.ofTotal(periodo.pct)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {ritmo?.enCurso && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.ongoing}</span>}
                <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: pctColor, fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>{money(periodo.gastado)}</div>
            {periodo.gastado > periodo.gastadoPuro && (
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>{t.spentBreakdown(money(periodo.gastadoPuro), money(periodo.gastado - periodo.gastadoPuro))}</div>
            )}
            <div className="bar-track" style={{ marginTop: 10 }}><div className="bar-fill" style={{ width: `${Math.min(periodo.pct, 100)}%`, background: pctColor }} /></div>
          </div>
        );
      })()}

      {/* Mini-stats fila 1 */}
      {reportOn("gastos_kpis") && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {esPeriodoVigente && tendenciaGasto !== null && (() => { const c = colorZ(periodos[0].gastadoPuro, periodos.slice(1).map((p) => p.gastadoPuro)); const mag = deltaMag(tendenciaGasto); const v = `${mag > 0 ? "+" : ""}${mag}%`; return (
          <MiniStat center basis="1 1 45%" label={t.trend} value={v} color={c}
            onClick={() => setKpiInfo({ title: t.trend, value: v, explain: `${t.kpiTrendInfo} Promedio histórico: ${oculto ? "••" : formatARS(Math.round(avgHistorico))}`, color: c })} />
        ); })()}
        {periodo.gastado > periodo.gastadoPuro && <MiniStat center basis="1 1 45%" label={t.realSpent} value={oculto ? "••" : abbr(periodo.gastadoPuro)} color="var(--red)"
          onClick={() => setKpiInfo({ title: t.realSpent, value: oculto ? "••" : formatARS(periodo.gastadoPuro), explain: t.kpiRealSpentInfo, color: "var(--red)" })} />}
      </div>
      )}

      {/* Mini-stats fila 2 */}
      {reportOn("gastos_kpis") && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {ritmo && <MiniStat center basis="1 1 45%" label={t.spendingPace} value={`${oculto ? "••" : abbr(ritmo.gastadoPorDia)}${t.perDay}`} color="var(--red)"
          onClick={() => setKpiInfo({ title: t.spendingPace, value: `${oculto ? "••" : formatARS(ritmo.gastadoPorDia)}${t.perDay}`, explain: `${t.kpiPaceInfo} (${t.projection30days(oculto ? "••" : formatARS(ritmo.proyeccionCierre))})`, color: "var(--red)" })} />}
        {promPorMov != null && <MiniStat center basis="1 1 45%" label={t.avgPerExpense} value={oculto ? "••" : abbr(promPorMov)} color="var(--red)"
          onClick={() => setKpiInfo({ title: t.avgPerExpense, value: oculto ? "••" : formatARS(promPorMov), explain: t.kpiAvgPerExpenseInfo, color: "var(--red)" })} />}
      </div>
      )}

      {/* Categorías */}
      {reportOn("gastos_otros") && (
      <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.byCategory}</span>
          {activos.length === 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {presupuestoEfectivo && Object.keys(presupuestoEfectivo).length > 0 && (
                <button onClick={() => setShowBudget(v => !v)} style={{ background: showBudget ? "var(--accent-dim)" : "transparent", border: `1px solid ${showBudget ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, color: showBudget ? "var(--accent)" : "var(--muted)", fontSize: 10, fontWeight: 600, padding: "3px 8px", cursor: "pointer", transition: "all 0.15s" }}>
                  {t.budget}
                </button>
              )}
              <button onClick={() => {
                const template = config?.meta.presupuestoTemplate ?? {};
                const base = presupuesto ?? template;
                setEditingBudget(Object.fromEntries(catsEditables.map((cat) => [cat, String(base[cat] ?? "")])));
                setModalBudget(true);
              }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex", alignItems: "center" }} aria-label={t.editBudget}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
        {catsConPresu.map((c) => <Bar key={c.categoria} nombre={c.categoria} monto={c.monto} pct={c.pct} color={esCatCompra(c.categoria) ? "var(--yellow)" : "var(--red)"} oculto={oculto} presupuesto={showBudget ? presupuestoEfectivo?.[c.categoria] : undefined} onClick={() => setCatModal(c.categoria)} />)}
      </div>
      )}

      {/* Comparativa vs anterior */}
      {anterior && reportOn("gastos_otros") && (
        <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.vsPrevPeriod}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>{shortPer(anterior.periodoId)}</div>
          {/* Tocar una fila abre lo que se gastó en esa categoría el período ANTERIOR (que es
              el término de comparación). Las que no tuvieron nada entonces no son clickeables:
              abrirían un modal vacío. */}
          {comp.filter((c) => c.actual > 0 || c.anterior > 0).slice(0, 8).map((c) => (
            <div key={c.categoria} className="row" role={c.anterior > 0 ? "button" : undefined}
              onClick={c.anterior > 0 ? () => setCatAnteriorModal(c.categoria) : undefined}
              style={{ padding: "8px 0", cursor: c.anterior > 0 ? "pointer" : "default" }}>
              <span style={{ fontSize: 13 }}>{c.categoria}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(() => { const diff = c.actual - c.anterior; return (
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{diff >= 0 ? "+" : "−"}{money(Math.abs(diff))}</span>
                ); })()}
                {c.deltaPct !== null ? (() => { const mag = deltaMag(c.deltaPct); return (
                  <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor(c.deltaPct, false), minWidth: 48, textAlign: "right" }}>
                    {mag === 0 ? "0" : <>{mag > 0 ? "↑" : "↓"}{Math.abs(mag)}</>}%
                  </span>
                ); })() : <span style={{ fontSize: 10, color: "var(--red)", minWidth: 48, textAlign: "right" }}>{t.new_}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anomalía: categorías que este período superaron en +50% el promedio de los 3
          anteriores. Complementa "vs anterior" (que es ruidoso, un solo período) sin
          reemplazarlo. */}
      {anomalias.length > 0 && reportOn("gastos_otros") && (
        <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.categoryAnomaly}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>{t.vsAverage(3)}</div>
          {anomalias.map((a) => (
            <div key={a.categoria} className="row" style={{ padding: "8px 0" }}>
              <span style={{ fontSize: 13 }}>{a.categoria}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{money(a.actual)}</span>
                {(() => { const mag = deltaMag(a.deltaPct); return (
                  <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor(a.deltaPct, false), minWidth: 48, textAlign: "right" }}>
                    ↑{Math.abs(mag)}%
                  </span>
                ); })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* "Top 5 descripciones" eliminado (v2.85.2): con el filtro in-place de Movimientos
          ya se ve el detalle por descripción; ahorra pantalla en Reportes. */}

      {/* "Por día" eliminado (v2.103.0): el total gastado de cada día ahora vive en el resumen
          del día colapsado en Movimientos, que es donde se mira el detalle diario. Misma
          lógica con la que se sacó "Top 5 descripciones" en v2.85.2. */}
    </>
  );
}
