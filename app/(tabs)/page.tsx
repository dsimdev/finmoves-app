"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "./data-context";
import { useMoney } from "@/hooks/useHideValues";
import { agruparPorPeriodo, fechaCorta, gastosPorCategoria } from "@/utils/periodo";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { serieTendencia, inflacionPersonal as calcInflacionPersonal, parsePeriodoId } from "@/utils/reportes";
import { duracionDisponible, duracionMedianaPeriodos } from "@/utils/duracion-disponible";
import { fechaISO_AR } from "@/utils/fecha-ar";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { Movimiento } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MiniStat } from "@/components/ui/MiniStat";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { MovementModal } from "@/components/movements/MovementModal";
import { ReminderCard } from "@/components/home/ReminderCard";
import { useT } from "@/hooks/useTranslation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useInflacionIPC } from "@/hooks/useInflacionIPC";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { DiasPeriodo } from "@/components/ui/DiasPeriodo";
import { SectionHint } from "@/components/ui/SectionHint";
import { useHint } from "@/hooks/useHint";
import { deltaColor, deltaMag, colorPct, colorPctDim } from "@/components/reports/format";

function TipoColor(m: Movimiento) {
  if (m.categoria === "RESTO") return "var(--blue)"; // arrastre a ahorros del período anterior
  if (m.tipo === "CompraUSD") return "var(--yellow)";
  if (m.tipo === "Gasto") return "var(--red)";
  if (m.tipo === "Move") return m.direccionMove === "aAhorro" ? "var(--purple)" : "var(--teal)";
  return "var(--green)";
}
function TipoPrefix(m: Movimiento) {
  if (m.categoria === "RESTO") return "+"; // arrastre que entra como ahorros
  // Move "a ahorros" sale del disponible → signo negativo.
  if (m.tipo === "Move" && m.direccionMove === "aAhorro") return "-";
  return m.tipo === "Gasto" || m.tipo === "CompraUSD" ? "-" : "+";
}

export default function Dashboard() {
  const { movimientos, loading, refresh, config, updateMovimiento, removeMovimiento, prependMovimiento } = useData();
  const { oculto, toggle: toggleOculto, m: money } = useMoney();
  const t = useT();
  const { dashboardClasico, monedaPrincipal, showAhorros } = useAppPrefs();
  const [showTapHint, dismissTapHint] = useHint("tapKpis");
  const { deflatar, ipcDisponible } = useInflacionIPC();
  const esARS = monedaPrincipal === "ARS";
  // El número es "real" (ajustado por IPC) solo si es ARS Y hay datos de IPC. Si la API
  // de inflación está caída, deflatar devuelve el monto nominal → no prometer que es real.
  const inflacionEsReal = esARS && ipcDisponible;

  // Modal de alta/edición abierto desde el propio inicio (sin navegar).
  const [modalState, setModalState] = useState<{ mode: "add" | "edit"; mov?: Movimiento; view?: "form" | "delete" } | null>(null);
  const [kpiInfo, setKpiInfo] = useState<{ title: string; value: string; explain: string; color?: string } | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const ultimoCargado = useMemo(() => {
    if (movimientos.length === 0) return null;
    return movimientos.reduce((a, b) =>
      new Date(a.timestampCarga).getTime() > new Date(b.timestampCarga).getTime() ? a : b
    ).timestampCarga;
  }, [movimientos]);
  const p = periodos[0];
  const serie = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const ahorrosAcum = serie.length ? serie[serie.length - 1].ahorrosAcum : 0;
  // Solo gasto puro (sin compras de divisa, que disparan promedio y desvío).
  const gastos = useMemo(() => p?.movimientos.filter((m) => m.tipo === "Gasto") ?? [], [p]);
  // Gasto de HOY (fecha AR): lo que llevás gastado en el día del período en curso.
  const gastadoHoy = useMemo(() => {
    const hoy = fechaISO_AR();
    return gastos.filter((m) => m.fecha === hoy).reduce((s, m) => s + m.monto, 0);
  }, [gastos]);
  const promPorMov = gastos.length > 0 ? Math.round(gastos.reduce((s, m) => s + m.monto, 0) / gastos.length) : 0;
  // Cuánto aguanta el disponible al ritmo del período, y cuánto se puede gastar por día para
  // llegar al cierre. Los días transcurridos se cuentan igual que en DiasPeriodo.
  const duracion = useMemo(() => {
    if (!p) return null;
    const dias = Math.max(1, Math.floor((Date.now() - parsePeriodoId(p.periodoId).getTime()) / 86_400_000) + 1);
    // Cuánto dura un período se MIDE de los períodos reales (son días de cobro, no meses):
    // sin esto, un ciclo quincenal se proyectaría contra 30 días y el número mentiría.
    const largo = duracionMedianaPeriodos(periodos.map((x) => parsePeriodoId(x.periodoId)));
    // El ritmo tiene que medir lo que REALMENTE baja el disponible, que es
    // `total - gastado - moveAhorros` (ver utils/periodo): usar solo gastadoPuro ignoraba
    // las compras de divisa y lo que se mueve a ahorros, y sobreestimaba cuánto dura.
    const consumido = p.gastado + p.moveAhorros;
    return duracionDisponible(p.disponible, consumido, dias, largo);
  }, [p, periodos]);
  // Misma métrica que la card de Períodos en Reportes: promedio de cuánto cambió tu gasto
  // entre períodos (helper compartido). Solo ARS deflacta por IPC (variación real); otras
  // monedas, nominal.
  const inflacionPersonal = useMemo(
    () => calcInflacionPersonal(periodos, esARS ? deflatar : undefined),
    [periodos, deflatar, esARS],
  );
  const isDesktop = useIsDesktop();
  // En escritorio la columna de movimientos tiene que llegar tan abajo como la del período:
  // con 5 filas queda cortada a la mitad de la pantalla.
  const ultimos = p?.movimientos
    .filter((m) => m.tipo !== "GastoUSD" && m.tipo !== "GastoEUR" && m.tipo !== "IngresoUSD" && m.tipo !== "IngresoEUR")
    .slice(0, isDesktop ? 11 : 5) ?? [];
  const pctDisp = p && p.total > 0 ? Math.round((p.disponible / p.total) * 100) : 0;
  // En escritorio sobra espacio bajo los atajos: el desglose por categoría del período
  // responde "en qué se me va" sin ir a Reportes. En móvil no entra y no se muestra.
  const catsPeriodo = useMemo(
    () => (p ? gastosPorCategoria(p.movimientos, p.gastado).slice(0, 8) : []),
    [p],
  );
  // Color anclado al gasto sobre el ingreso (misma escala que Reportes): verde mientras
  // hay margen, rojo solo al pasarte. Así no se pone en alerta por mover plata a ahorros.
  const gastadoPct = p && p.total > 0 ? (p.gastado / p.total) * 100 : 0;
  const barColor = colorPct(gastadoPct);
  const barColorDim = colorPctDim(gastadoPct);

  return (
    <div className="page page-fluid">

      {loading ? (
        <LoadingSpinner />
      ) : !p ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
          {t.noData}
        </div>
      ) : (
        <div className="fade-up">
          {/* Header: período (izq) · INICIO (centro) · campana (der) */}
          <PageHeader
            title={t.pageTitleDashboard}
            subtitle={<div style={{ marginTop: 2 }}><DiasPeriodo periodoId={p.periodoId} /></div>}
            right={<NotificationsBell />}
          />

          {/* En escritorio: estado del período a la izquierda, últimos movimientos a la
              derecha (en móvil quedan al final de un scroll largo). */}
          <div className="home-grid">
          <div>

          {/* Hero */}
          <div className="soft home-hero" style={{ borderColor: `${barColor}44`, marginBottom: 12, background: `linear-gradient(135deg, var(--surface) 0%, ${barColorDim} 100%)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 7 }}>{t.available}</div>
                <div className="home-hero-value" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, color: "var(--text)", lineHeight: 1, fontFamily: "var(--font-mono)" }}>
                  {money(p.disponible)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 7 }}>
                  {t.of} {money(p.total)} · {p.movimientos.length} {t.movementsShort}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
                <span className="badge" style={{ background: barColor + "20", color: barColor, border: `1px solid ${barColor}44` }}>{pctDisp}%</span>
                <button onClick={toggleOculto} aria-label={t.hideValues} style={{
                  background: "none", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 6,
                }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(pctDisp, 100))}%`, background: barColor }} />
            </div>
          </div>

          {/* Hint: los KPIs son tappeables. Solo en modo no-clásico (ahí tienen onClick). */}
          {!dashboardClasico && showTapHint && <SectionHint title={t.hintHomeTitle} body={t.hintHomeBody} onDismiss={dismissTapHint} />}

          {/* KPIs */}
          <div className="home-kpis" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {dashboardClasico ? (<>
              <MiniStat basis="1 1 45%" label={t.salary} value={money(p.sueldo)} color="var(--green)" />
              <MiniStat basis="1 1 45%" label={t.spent} value={money(p.gastadoPuro)} color="var(--red)" />
              <MiniStat basis="1 1 45%" label={t.savings} value={money(ahorrosAcum)} color="var(--blue)" />
              <MiniStat basis="1 1 45%" label={t.withdrawals} value={p.extras > 0 ? money(p.extras) : "—"} color="var(--teal)" />
            </>) : (<>
              {/* Cuánto llevás gastado HOY, coloreado contra la recomendación diaria (el KPI
                  "gastá por día"): verde si gastaste menos, amarillo si estás cerca, rojo si
                  igualaste o pasaste el presupuesto del día. Sin recomendación (período cerrado
                  o sin datos) queda neutro. */}
              {(() => {
                const sug = duracion?.porDiaSugerido ?? null;
                const c = sug == null || gastadoHoy === 0 ? "var(--text)"
                  : gastadoHoy >= sug ? "var(--red)"
                  : gastadoHoy >= sug * 0.85 ? "var(--yellow)"
                  : "var(--green)";
                return (
                  <MiniStat center basis="1 1 45%" label={t.today} value={money(gastadoHoy)} color={c}
                    onClick={() => setKpiInfo({ title: t.todaySpent, value: money(gastadoHoy), explain: t.kpiTodaySpentInfo, color: c })} />
                );
              })()}
              {/* Cuánto se puede gastar por día para llegar al cierre. Reemplazó al desvío
                  (un coeficiente de variación describía el pasado; esto dice qué hacer).
                  Va arriba, junto a Hoy: los dos hablan del período en curso. */}
              {(() => {
                const sug = duracion?.porDiaSugerido ?? null;
                const v = sug === null ? "—" : money(Math.round(sug));
                // Verde si al ritmo actual llegás al cierre; ROJO si no (hay que gastar menos
                // que ahora para llegar, que es exactamente lo que el número está diciendo).
                const c = sug === null ? "var(--muted)" : duracion!.llega ? "var(--green)" : "var(--red)";
                // El detalle suma cuánto dura a tu ritmo actual: es el contraste que da sentido
                // al objetivo. Va "aprox" porque el largo del período es una estimación (la
                // mediana de los anteriores), nunca un dato cerrado.
                const explain = duracion?.dias == null
                  ? t.kpiCanSpendPerDayInfo
                  : `${t.kpiCanSpendPerDayInfo} ${t.kpiLastsApprox(duracion.dias, duracion.diasRestantes)}`;
                return (
                  <MiniStat center basis="1 1 45%" label={t.canSpendPerDay} value={v} color={c}
                    onClick={() => setKpiInfo({ title: t.canSpendPerDay, value: v, explain, color: c })} />
                );
              })()}
              {(() => { const ip = inflacionPersonal; const c = ip == null ? "var(--muted)" : deltaColor(ip, false); const mag = ip == null ? null : deltaMag(ip); const v = mag == null ? "—" : `${mag > 0 ? "+" : ""}${mag}%`; const label = inflacionEsReal ? t.inflation : t.inflationNominal; return (
                <MiniStat center basis="1 1 45%" label={label} value={v} color={c}
                  onClick={() => setKpiInfo({ title: label, value: v, explain: inflacionEsReal ? t.kpiInflationInfo : t.kpiInflationInfoNominal, color: c })} />
              ); })()}
              <MiniStat center basis="1 1 45%" label={t.accumSavings} value={ahorrosAcum > 0 ? money(ahorrosAcum) : "—"} color="var(--blue)"
                onClick={() => setKpiInfo({ title: t.accumSavings, value: money(ahorrosAcum), explain: t.kpiAccumSavingsInfo, color: "var(--blue)" })} />
            </>)}
          </div>

          {/* Atajos */}
          {(() => {
            const chip: React.CSSProperties = {
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              padding: "12px 8px", textDecoration: "none", color: "var(--muted)", cursor: "pointer",
            };
            const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" };
            const svg = (color: string, children: React.ReactNode) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
            );
            return (
              <div className="home-shortcuts" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {/* Nuevo movimiento → abre el modal acá mismo */}
                <button onClick={() => setModalState({ mode: "add" })} style={{ ...chip, border: "1px solid var(--border)" }}>
                  {svg("var(--green)", <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>)}
                  <span style={lbl}>{t.newShort}</span>
                </button>
                {/* Divisa: abre el modal en modo reserva (FX). Solo con inversión activa y
                    moneda principal ARS (la reserva FX no aplica si ya operás en USD/EUR). */}
                {showAhorros && esARS && (
                  <button onClick={() => setReserveOpen(true)} style={{ ...chip, border: "1px solid var(--border)" }}>
                    {svg("var(--yellow)", <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>)}
                    <span style={lbl}>{t.reserve}</span>
                  </button>
                )}
                {/* Recordatorio: card de carga rápida (texto + fecha). Ícono de calendario
                    (la campana confundía con notificaciones) y color teal. */}
                <button onClick={() => setReminderOpen(true)} style={{ ...chip, border: "1px solid var(--border)" }}>
                  {svg("var(--teal)", <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>)}
                  <span style={lbl}>{t.reminderShort}</span>
                </button>
              </div>
            );
          })()}

          {/* En escritorio, el desglose del período llena el espacio que queda bajo los
              atajos y responde "en qué se me va" sin ir a Reportes. */}
          {isDesktop && catsPeriodo.length > 0 && (
            <div className="soft" style={{ background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byCategory}</div>
              {catsPeriodo.map((c) => (
                <div key={c.categoria} style={{ marginBottom: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, gap: 12 }}>
                    <span style={{ fontSize: 13 }}>{c.categoria}</span>
                    <span style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                      {money(c.monto)}
                      <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 11 }}>{c.pct}%</span>
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.min(c.pct, 100)}%`, background: "var(--red)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          </div>

          {/* Latest movements */}
          <div className="home-side">
          <div className="soft" style={{ background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.latestMovements}</div>
              {ultimoCargado && (
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  {t.last} {new Date(ultimoCargado).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" })}
                </div>
              )}
            </div>
            {ultimos.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noMovements}</div>
            ) : ultimos.map((m) => (
              // Inicio = solo lectura: tap abre el detalle SIN acciones (ni swipe ni editar/borrar).
              // Para operar se va a Movimientos.
              <button key={m.id}
                onClick={() => setModalState({ mode: "edit", mov: m })}
                className="row" style={{ width: "100%", padding: "11px 0", background: "none", border: "none", textAlign: "left", color: "inherit", cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.descripcion || m.categoria}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{m.categoria} · {fechaCorta(m.fecha)}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: TipoColor(m), marginLeft: 12, whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                  {TipoPrefix(m)}{money(m.monto)}
                </span>
              </button>
            ))}
            {p.movimientos.length > ultimos.length && (
              <Link href="/movements" style={{
                display: "block", textAlign: "center", margin: "14px auto 2px",
                color: "var(--muted)", fontSize: 12, fontStyle: "italic",
                textDecoration: "none",
              }}>
                {t.seeMore}
              </Link>
            )}
          </div>
          </div>
          </div>
        </div>
      )}

      {kpiInfo && <KpiInfoModal title={kpiInfo.title} value={kpiInfo.value} explain={kpiInfo.explain} color={kpiInfo.color} onClose={() => setKpiInfo(null)} />}
      <MovementModal
        open={modalState !== null}
        mode={modalState?.mode ?? "add"}
        movimiento={modalState?.mov ?? null}
        movimientos={movimientos}
        config={config}
        activePeriodoId={p?.periodoId}
        initialView={modalState?.view}
        onClose={() => setModalState(null)}
        onChanged={refresh}
        onCreated={prependMovimiento}
        onUpdated={updateMovimiento}
        onDeleted={removeMovimiento}
      />
      <ReminderCard open={reminderOpen} onClose={() => setReminderOpen(false)} />
      {/* Carga de divisa (modo reserva) desde el atajo del Inicio. */}
      <MovementModal
        open={reserveOpen}
        mode="add"
        reserveMode
        movimiento={null}
        movimientos={movimientos}
        config={config}
        activePeriodoId={p?.periodoId}
        onClose={() => setReserveOpen(false)}
        onChanged={refresh}
        onCreated={prependMovimiento}
        onUpdated={updateMovimiento}
        onDeleted={removeMovimiento}
      />
    </div>
  );
}
