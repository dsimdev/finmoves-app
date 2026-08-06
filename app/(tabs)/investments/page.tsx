"use client";

import { useState, useEffect, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../data-context";
import { MovementModal } from "@/components/movements/MovementModal";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useT } from "@/hooks/useTranslation";
import { useHint } from "@/hooks/useHint";
import { SectionHint } from "@/components/ui/SectionHint";

function fechaCortaConAnio(fecha: string): string {
  if (!fecha) return "";
  if (fecha.includes("-")) {
    const [y, m, d] = fecha.split("-");
    return `${d}/${m}/${y.slice(-2)}`;
  }
  if (fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${(y??"").slice(-2)}`;
  }
  return fecha;
}
import { agruparPorPeriodo } from "@/utils/periodo";
import { serieTendencia, progresoMetaPropia, parsePeriodoId, ritmoAhorro, desdeSeed, periodosHastaFecha, ritmoNecesarioParaFecha } from "@/utils/reportes";
import { duracionMedianaPeriodos } from "@/utils/duracion-disponible";
import { SimuladorMeta } from "@/components/investments/SimuladorMeta";
import { useInflacionIPC } from "@/hooks/useInflacionIPC";
import { useMoney, MASK } from "@/hooks/useHideValues";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MiniStat } from "@/components/ui/MiniStat";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { Movimiento } from "@/types";
import { calcularReserva } from "@/utils/reserva";
import { PageHeader } from "@/components/ui/PageHeader";
import { SwipeAway } from "@/components/ui/SwipeAway";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { eliminarMovimiento } from "@/services/firebase/movimientos";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { InvestmentsBoard, type KpiGrupo, type MetaBoard } from "@/components/desktop/InvestmentsBoard";
import { FxHistoryTable } from "@/components/desktop/FxHistoryTable";
import { MediaViewer } from "@/components/ui/MediaViewer";

export default function DolaresPage() {
  const { movimientos, loading, config, refresh: refreshData, updateMovimiento, removeMovimiento, prependMovimiento } = useData();
  const { user } = useAuth();
  const { cotizacion, minutosDesdeActualizacion, refresh } = useCotizacion();
  const { deflatar } = useInflacionIPC();

  // Modal: alta de reserva (+/-) desde el botón, o detalle/edición al tocar una fila del historial.
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; mov: Movimiento } | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  // Borrado por swipe de un ingreso/gasto de divisa (no existen en Movimientos).
  const [fxDelete, setFxDelete] = useState<Movimiento | null>(null);
  const [fxDeleting, setFxDeleting] = useState(false);
  const [kpiInfo, setKpiInfo] = useState<{ title: string; value: string; explain: string; color?: string } | null>(null);
  // Comprobante del historial FX (escritorio): se abre a pantalla completa desde la fila.
  const [viewer, setViewer] = useState<{ src: string; isPdf: boolean } | null>(null);

  useEffect(() => { refresh(); }, []);
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();

  const [showHint, dismissHint] = useHint("tapKpis");
  // En escritorio los números salen de las cards y se muestran como tablero.
  const isDesktop = useIsDesktop();

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" :
    monedaPrincipal === "EUR" ? "USD" :
    monedaInversiones;
  const esEUR = monedaInversionesEfectiva === "EUR";
  const simbolo = esEUR ? "€" : "U$D";

  // La cotización del usuario es SIEMPRE la oficial (el blue solo se elige en la carga).
  // Si hay cotización manual activa, reemplaza al oficial SOLO en la moneda de inversión activa.
  const manualOn = !!config?.meta.cotizacionManualActiva && (config?.meta.cotizacionManual ?? 0) > 0;
  const manualVal = config?.meta.cotizacionManual ?? 0;
  const cotizacionUSD = manualOn && !esEUR ? manualVal : (cotizacion ? cotizacion.oficial : null);
  const cotizacionEUR = manualOn && esEUR ? manualVal : (cotizacion ? cotizacion.oficial_euro ?? null : null);

  // ── USD ──
  const comprasUSD = movimientos
    .filter((m) => m.tipo === "CompraUSD" || m.tipo === "GastoUSD" || m.tipo === "VentaUSD" || m.tipo === "IngresoUSD")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialUSD = comprasUSD; // compras (+) y retiros (−) de la reserva
  const { total: desdeMovimientosUSD, costoPromedio: costoPromedioUSD } = calcularReserva(comprasUSD, "USD");
  // La reserva es SOLO lo cargado como movimientos: el saldo inicial a mano se eliminó
  // (los ahorros se calculan, no se cargan). Ver CHANGELOG v2.89.1.
  const totalUSD = desdeMovimientosUSD;
  const reservaUSDenARS = cotizacionUSD ? totalUSD * cotizacionUSD : null;
  const gananciaUSD = cotizacionUSD && costoPromedioUSD > 0 ? desdeMovimientosUSD * (cotizacionUSD - costoPromedioUSD) : null;
  const gananciaPctUSD = gananciaUSD && desdeMovimientosUSD * costoPromedioUSD > 0 ? (gananciaUSD / (desdeMovimientosUSD * costoPromedioUSD)) * 100 : null;

  // ── EUR ──
  const comprasEUR = movimientos
    .filter((m) => m.tipo === "CompraEUR" || m.tipo === "GastoEUR" || m.tipo === "VentaEUR" || m.tipo === "IngresoEUR")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialEUR = comprasEUR; // compras (+) y retiros (−) de la reserva
  const { total: desdeMovimientosEUR, costoPromedio: costoPromedioEUR } = calcularReserva(comprasEUR, "EUR");
  const totalEUR = desdeMovimientosEUR;
  const reservaEURenARS = cotizacionEUR ? totalEUR * cotizacionEUR : null;
  const gananciaEUR = cotizacionEUR && costoPromedioEUR > 0 ? desdeMovimientosEUR * (cotizacionEUR - costoPromedioEUR) : null;
  const gananciaPctEUR = gananciaEUR && desdeMovimientosEUR * costoPromedioEUR > 0 ? (gananciaEUR / (desdeMovimientosEUR * costoPromedioEUR)) * 100 : null;

  // ── Visibilidad de secciones FX (reserva/historial): solo si la parte FX está activa
  //    (ARS + permiso). La meta propia NO depende de esto (es para todos). showFX se define
  //    más abajo junto con esARS; acá se calcula la visibilidad por moneda de reserva. ──
  const showUSD = historialUSD.length > 0 || !esEUR;
  const showEUR = historialEUR.length > 0 || esEUR;
  const hasBoth = historialUSD.length > 0 && historialEUR.length > 0;

  // ── Meta — aplica a la moneda primaria configurada ──
  const totalDisplay = esEUR ? totalEUR : totalUSD;
  const metaUSD = config?.meta.metaPorPeriodo ?? config?.meta.usdMensual ?? 400;

  // ── Tendencias de inversión ──
  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);

  const metaMonto = config?.meta.metaMonto ?? null;
  // Origen ÚNICO de todos los promedios (ahorros y reserva FX): desde acá se acumula y se
  // promedia. `inversionSeedPeriodoId` quedó obsoleto al unificar en un solo seed.
  const seedId = config?.meta.ahorrosAcumSeedPeriodoId;

  // ── Net worth ──
  const disponibleActual = periodos[0]?.disponible ?? 0;
  const ahorrosTotales = useMemo(() => {
    const serie = serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId ?? undefined);
    return serie.length > 0 ? serie[serie.length - 1].ahorrosAcum : 0;
  }, [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const fxEnARS = (reservaUSDenARS ?? 0) + (reservaEURenARS ?? 0);
  const totalPatrimonio = disponibleActual + ahorrosTotales + fxEnARS;
  const totalEnUSD = cotizacionUSD && cotizacionUSD > 0 ? totalPatrimonio / cotizacionUSD : null;
  const showNetWorth = fxEnARS > 0;

  // Reserva FX (comprar divisa, patrimonio, meta FX): solo ARS con inversión habilitada.
  // showAhorros ya gatea la tab entera; acá adentro la META PROPIA es para TODOS y la
  // reserva FX depende de moneda ARS + permiso de inversión (dueño o permiso).
  const esARS = monedaPrincipal === "ARS";
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;
  const showFX = esARS && inversionAllowed;
  const simboloPropio = monedaPrincipal === "EUR" ? "€" : monedaPrincipal === "USD" ? "U$D" : "$";

  // Meta propia: progreso sobre los ahorros acumulados ya calculados (misma serie del patrimonio).
  const serieAhorros = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId ?? undefined), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const metaPropia = config?.meta.metaPropia;
  // Deflactar solo en ARS: en USD/EUR el IPC argentino no aplica (identidad).
  const deflateAhorro = monedaPrincipal === "ARS" ? deflatar : undefined;
  // Memoizado: se usa como dependencia de boardGrupos (useMemo) más abajo, y sin esto era un
  // objeto nuevo en cada render.
  const progresoPropia = useMemo(
    () => metaPropia?.monto ? progresoMetaPropia(serieAhorros, metaPropia.monto, deflateAhorro, seedId) : null,
    [metaPropia, serieAhorros, deflateAhorro, seedId]
  );
  // Ritmo de ahorro (moneda propia) para el simulador de la meta propia.
  const ritmoPropio = useMemo(() => ritmoAhorro(serieAhorros, deflateAhorro, seedId), [serieAhorros, deflateAhorro, seedId]);
  const fxLabel = historialUSD.length > 0 && historialEUR.length > 0 ? "divisas" : historialEUR.length > 0 ? "EUR" : "U$D";

  // Ritmo necesario para llegar a la FECHA de la meta propia (hoy la fecha es decorativa:
  // se muestra pero nunca se cruza contra el ritmo real). Solo se calcula con fecha puesta;
  // solo se avisa si el ritmo actual no alcanza (silencio si vas bien o adelantado).
  const diasPorPeriodo = useMemo(
    () => duracionMedianaPeriodos(periodos.map((p) => parsePeriodoId(p.periodoId))),
    [periodos]
  );
  const ritmoNecesarioPropia = metaPropia?.fecha && progresoPropia && progresoPropia.faltante > 0
    ? ritmoNecesarioParaFecha(progresoPropia.faltante, periodosHastaFecha(metaPropia.fecha, diasPorPeriodo))
    : null;
  const vaAtrasadoPropia = ritmoNecesarioPropia !== null && (ritmoPropio === null || ritmoPropio < ritmoNecesarioPropia);

  // Ritmo/proyección/mejor-peor: mismas reglas que Reportes (ritmoAhorro): delta REAL del
  // acumulado, ventana desde el seed (período en curso incluido) y deflactado en ARS.
  const ahorroStats = useMemo(() => {
    const ritmo = ritmoAhorro(serieAhorros, deflateAhorro, seedId);
    if (ritmo === null) return null;
    // Misma ventana que ritmoAhorro: desde el seed, incluido el período en curso.
    const ventana = desdeSeed(serieAhorros, seedId);
    if (ventana.length === 0) return null;
    // `deltaAcum` igual que el ritmo: el "peor período" tiene que ser una caída que el
    // acumulado haya tenido de verdad, no un retiro mayor a lo que había registrado.
    const conNeto = ventana.map((p) => {
      const d = p.deltaAcum ?? p.ahorroNeto;
      return { periodoId: p.periodoId, delta: deflateAhorro ? deflateAhorro(d, p.periodoId) : d };
    });
    const acum = serieAhorros[serieAhorros.length - 1]?.ahorrosAcum ?? 0;
    const mejor = conNeto.reduce((a, b) => (b.delta > a.delta ? b : a));
    const peor = conNeto.reduce((a, b) => (b.delta < a.delta ? b : a));
    // La proyección sigue el ritmo real: si es negativo el acumulado BAJA (no se congela en 0,
    // que contradecía al "por período" negativo mostrado al lado). Piso en 0: no hay ahorro < 0.
    return { ritmo, proyeccion: Math.max(0, acum + ritmo * 3), mejor, peor };
  }, [serieAhorros, deflateAhorro, seedId]);

  // Auto-anclar el seed la primera vez al PRIMER período con movimientos: los promedios usan
  // toda la historia del usuario. (Antes anclaba al período en curso y descartaba lo anterior.)
  // Se puede mover después desde Reportes; es el único origen, común a ahorros y reserva FX.
  useEffect(() => {
    if (!user?.uid || !config || config.meta.ahorrosAcumSeedPeriodoId || periodos.length === 0) return;
    const primero = periodos[periodos.length - 1].periodoId; // periodos[0] es el más nuevo
    updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.ahorrosAcumSeedPeriodoId": primero });
  }, [user?.uid, !!config, config?.meta.ahorrosAcumSeedPeriodoId, periodos.length]);

  // FX neto comprado por período (CompraFX - GastoFX - VentaFX por cantidadUSD).
  const tipoCompraFX  = esEUR ? "CompraEUR"  : "CompraUSD";
  const tipoGastoFX   = esEUR ? "GastoEUR"   : "GastoUSD";
  const tipoVentaFX   = esEUR ? "VentaEUR"   : "VentaUSD";
  const tipoIngresoFX = esEUR ? "IngresoEUR" : "IngresoUSD";
  const netFXDe = (movs: Movimiento[]) => movs.reduce((s, m) => {
    if ((m.tipo === tipoCompraFX || m.tipo === tipoIngresoFX) && m.cantidadUSD) return s + m.cantidadUSD;
    if ((m.tipo === tipoGastoFX || m.tipo === tipoVentaFX) && m.cantidadUSD) return s - m.cantidadUSD;
    return s;
  }, 0);

  // Ritmo FX: flujo NETO de divisa por período (compras + ingresos − gastos − ventas), desde
  // el seed hasta el actual inclusive. Mismo origen y mismas reglas que el ritmo de ahorro
  // (ver ritmoAhorro), para que dos números de la misma pantalla no promedien distinto.
  // No se deflacta: la divisa ya es la unidad estable.
  // periodos[0] es el más NUEVO → la ventana va del 0 hasta el índice del seed.
  const promAhorroUSD = useMemo(() => {
    if (periodos.length === 0) return null;
    const seedIdx = seedId ? periodos.findIndex((p) => p.periodoId === seedId) : periodos.length - 1;
    const ventana = periodos.slice(0, (seedIdx >= 0 ? seedIdx : periodos.length - 1) + 1);
    if (ventana.length === 0) return null;
    return ventana.reduce((s, p) => s + netFXDe(p.movimientos), 0) / ventana.length;
  }, [periodos, seedId, tipoCompraFX, tipoGastoFX, tipoVentaFX, tipoIngresoFX]);

  // Un ritmo negativo (vendiste más de lo que compraste) se muestra tal cual, en rojo: antes
  // se descartaba y las tarjetas de proyección/meta desaparecían sin explicar por qué.
  const ritmoFX = promAhorroUSD ?? 0;
  const periodosParaMeta = metaMonto && ritmoFX > 0
    ? Math.ceil(Math.max(0, metaMonto - totalDisplay) / ritmoFX) : null;
  const proyUSD = promAhorroUSD !== null ? Math.max(0, totalDisplay + ritmoFX * 3) : null;

  // Ritmo necesario para llegar a la fecha de la meta FX (mismo criterio que la meta propia).
  const faltanteFX = metaMonto ? Math.max(0, metaMonto - totalDisplay) : 0;
  const ritmoNecesarioFX = config?.meta.metaFX?.fecha && faltanteFX > 0
    ? ritmoNecesarioParaFecha(faltanteFX, periodosHastaFecha(config.meta.metaFX.fecha, diasPorPeriodo))
    : null;
  const vaAtrasadoFX = ritmoNecesarioFX !== null && ritmoFX < ritmoNecesarioFX;

  // ── Tablero de escritorio ──
  // Los mismos números que las cards del móvil, pero sueltos: en pantalla ancha el marco de
  // la card solo encierra. La lógica es la ya calculada arriba; acá solo se formatea.
  // Un grupo por TEMA, con el color que esa sección tiene en móvil: patrimonio verde,
  // reserva amarilla. Los datos de un mismo tema van juntos en su card.
  const boardGrupos: KpiGrupo[] = useMemo(() => {
    const g: KpiGrupo[] = [];

    // Patrimonio: el total y de qué se compone.
    if (showFX && showNetWorth) {
      g.push({
        titulo: t.netWorth, color: "var(--green)",
        kpis: [
          {
            label: t.total, value: money(totalPatrimonio), hero: true, color: "var(--green)",
            sub: totalEnUSD ? `≈ U$D ${totalEnUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })} · ${t.official}` : undefined,
          },
          { label: t.available, value: money(disponibleActual) },
          { label: t.savings, value: money(ahorrosTotales) },
          ...(fxEnARS > 0 ? [{ label: simbolo, value: money(fxEnARS) }] : []),
        ],
      });
    } else {
      g.push({
        titulo: t.savings, color: "var(--green)",
        kpis: [{ label: t.total, value: money(ahorrosTotales), hero: true, color: "var(--green)" }],
      });
    }

    // Posición en divisa: cuánto tenés, a qué precio lo compraste y cuánto ganaste. Los
    // tres son el mismo tema, por eso van en una card y no sueltos entre los demás.
    if (showFX) {
      const cotiz = esEUR ? cotizacionEUR : cotizacionUSD;
      const ganancia = esEUR ? gananciaEUR : gananciaUSD;
      const gananciaPct = esEUR ? gananciaPctEUR : gananciaPctUSD;
      const costoProm = esEUR ? costoPromedioEUR : costoPromedioUSD;
      g.push({
        titulo: t.reserve, color: "var(--yellow)",
        kpis: [
          {
            label: simbolo, value: oculto ? MASK : `${simbolo} ${totalDisplay.toFixed(2)}`, hero: true, color: "var(--yellow)",
            sub: cotiz ? `≈ ${money(totalDisplay * cotiz)} · ${t.official} $${Math.round(cotiz).toLocaleString("es-AR")}` : undefined,
          },
          ...(costoProm > 0 ? [{ label: t.avgPrice, value: oculto ? MASK : `$${Math.round(costoProm).toLocaleString("es-AR")}` }] : []),
          ...(ganancia !== null ? [{
            label: t.profit,
            value: oculto ? MASK : `${ganancia >= 0 ? "+" : ""}${money(ganancia)}`,
            color: ganancia >= 0 ? "var(--green)" : "var(--red)",
            sub: gananciaPct !== null ? `${gananciaPct >= 0 ? "+" : ""}${gananciaPct.toFixed(1)}%` : undefined,
          }] : []),
        ],
      });
    }

    // Ritmo de ahorro y su proyección. "Por período" solo no dice de qué.
    if (ahorroStats) {
      g.push({
        titulo: t.savingsRateTitle, color: "var(--blue)",
        kpis: [
          {
            label: t.perPeriodSub,
            value: oculto ? MASK : `${simboloPropio} ${Math.round(ahorroStats.ritmo).toLocaleString("es-AR")}`,
            hero: true,
            color: ahorroStats.ritmo < 0 ? "var(--red)" : "var(--green)",
          },
          { label: t.statProjection, value: oculto ? MASK : `${simboloPropio} ${Math.round(ahorroStats.proyeccion).toLocaleString("es-AR")}` },
        ],
      });
    }
    return g;
  }, [showFX, showNetWorth, totalPatrimonio, totalEnUSD, disponibleActual, ahorrosTotales, esEUR,
      cotizacionEUR, cotizacionUSD, gananciaEUR, gananciaUSD, gananciaPctEUR, gananciaPctUSD,
      costoPromedioEUR, costoPromedioUSD, totalDisplay, simbolo, simboloPropio, ahorroStats,
      fxEnARS, oculto, money, t]);

  const boardMetas: MetaBoard[] = useMemo(() => {
    const m: MetaBoard[] = [];
    if (showFX && metaMonto) {
      const pct = Math.min(100, Math.round((totalDisplay / metaMonto) * 100));
      m.push({
        label: t.fxGoal, fecha: fechaCortaConAnio(config?.meta.metaFX?.fecha ?? config?.meta.metaFecha ?? ""),
        objetivo: `${simbolo} ${metaMonto.toLocaleString("es-AR")}`,
        faltante: oculto ? MASK : (metaMonto - totalDisplay).toLocaleString("es-AR", { maximumFractionDigits: 0 }),
        pct, color: pct >= 80 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)",
        alcanzada: totalDisplay >= metaMonto,
        stats: [
          { label: t.statPerPeriod, value: oculto ? MASK : Math.round(ritmoFX).toLocaleString("es-AR") },
          ...(proyUSD !== null ? [{ label: t.statProjection, value: oculto ? MASK : Math.round(proyUSD).toLocaleString("es-AR") }] : []),
          ...(periodosParaMeta !== null ? [{ label: t.statToGoal, value: periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}` }] : []),
        ],
      });
    }
    if (progresoPropia && metaPropia) {
      m.push({
        label: t.savingsGoal, fecha: fechaCortaConAnio(metaPropia.fecha ?? ""),
        objetivo: oculto ? MASK : money(progresoPropia.acumulado),
        faltante: oculto ? MASK : money(progresoPropia.faltante),
        pct: progresoPropia.pct,
        color: progresoPropia.pct >= 80 ? "var(--green)" : progresoPropia.pct >= 40 ? "var(--yellow)" : "var(--red)",
        alcanzada: progresoPropia.faltante <= 0,
        stats: progresoPropia.periodos !== null
          ? [{ label: t.statToGoal, value: progresoPropia.periodos === 0 ? t.reached : `${progresoPropia.periodos} ${t.periodsShort}` }]
          : undefined,
      });
    }
    return m;
  }, [showFX, metaMonto, totalDisplay, simbolo, config, oculto, ritmoFX, proyUSD, periodosParaMeta, progresoPropia, metaPropia, money, t]);

  // Card de meta propia (sobre ahorros, moneda principal). Se ubica arriba (usuario sin FX)
  // o al final (usuario ARS con reserva FX) — ver render.
  const metaPropiaCard = progresoPropia && metaPropia ? (() => {
    const alcanzada = progresoPropia.faltante <= 0;
    const barColor = progresoPropia.pct >= 80 ? "var(--green)" : progresoPropia.pct >= 40 ? "var(--yellow)" : "var(--red)";
    return (
      <div className="card" style={{ background: "var(--surface)", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="label" style={{ marginBottom: 0 }}>{t.savingsGoal}</div>
            {alcanzada && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.reachedBadge}</span>}
          </div>
          {metaPropia.fecha && <div style={{ fontSize: 9, color: "var(--muted)" }}>{fechaCortaConAnio(metaPropia.fecha)}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
            {oculto ? "••••" : `${simboloPropio} ${progresoPropia.acumulado.toLocaleString("es-AR")}`}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{t.savingsGoalOf(`${simboloPropio} ${metaPropia.monto.toLocaleString("es-AR")}`)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: alcanzada ? "var(--green)" : "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {alcanzada ? t.reached : t.remainingShort(oculto ? "••" : `${simboloPropio} ${Math.round(progresoPropia.faltante).toLocaleString("es-AR")}`)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="progress-track" style={{ flex: 1, margin: 0 }}>
            <div className="progress-fill" style={{ width: `${progresoPropia.pct}%`, background: barColor }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "right" }}>{progresoPropia.pct}%</span>
        </div>
        {/* Sin ritmo positivo no hay estimación posible (estarías alejándote de la meta):
            en vez de dejar la card muda, se dice por qué. */}
        <div style={{ fontSize: 11, color: progresoPropia.periodos === null ? "var(--red)" : "var(--muted)", marginTop: 10 }}>
          {progresoPropia.periodos === null
            ? t.noSavingsPace
            : progresoPropia.periodos === 0 ? t.reached : t.savingsGoalPeriods(progresoPropia.periodos)}
        </div>
        {/* Ritmo vs fecha objetivo: silencio si vas bien/adelantado, solo avisa si el ritmo
            actual no alcanza para llegar a tiempo. La fecha era puramente decorativa antes. */}
        {vaAtrasadoPropia && ritmoNecesarioPropia !== null && (
          <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 6 }}>
            {t.goalBehindPace(`${simboloPropio} ${Math.round(ritmoNecesarioPropia).toLocaleString("es-AR")}`, fechaCortaConAnio(metaPropia.fecha ?? ""))}
          </div>
        )}
        {/* Simulador: solo tiene sentido si todavía falta (no en meta ya alcanzada). Una
            perilla: cuánto más ahorrás por período (va a ahorros en pesos). */}
        {!alcanzada && (
          <SimuladorMeta
            faltante={progresoPropia.faltante}
            ritmo={ritmoPropio}
            color="var(--purple)"
            formatMonto={(n) => `${simboloPropio} ${Math.round(n).toLocaleString("es-AR")}`}
            perillas={[{ label: t.simSaveMore, control: t.simSavePerPeriod, max: 150000, step: 5000 }]}
          />
        )}
      </div>
    );
  })() : null;

  // ── Cards para el usuario SIN reserva FX (EUR/USD). Patrimonio en su moneda + ritmo + mejor/peor.
  const mesDePeriodo = (periodoId: string) => {
    const d = parsePeriodoId(periodoId);
    return isNaN(d.getTime()) ? periodoId : d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  };

  const patrimonioPropioCard = (
    <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--green) 8%, var(--surface)) 100%)", border: "1px solid color-mix(in srgb, var(--green) 20%, var(--border))", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 0 }}>{t.netWorthLabel}</div>
        <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
          <EyeIcon off={oculto} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[{ label: t.available, value: disponibleActual }, { label: t.savings, value: ahorrosTotales }].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
            <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{oculto ? "••••" : `${simboloPropio} ${value.toLocaleString("es-AR")}`}</span>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: "color-mix(in srgb, var(--green) 25%, var(--border))", margin: "12px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 4, textTransform: "capitalize" }}>total</span>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -1, lineHeight: 1, background: "linear-gradient(110deg, var(--green) 0%, var(--blue) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          {oculto ? "••••" : `${simboloPropio} ${(disponibleActual + ahorrosTotales).toLocaleString("es-AR")}`}
        </div>
      </div>
    </div>
  );

  const ritmoPropioCard = ahorroStats ? (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="label" style={{ marginBottom: 14 }}>{t.savingsRateTitle}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <MiniStat basis="1 1 0" center color={ahorroStats.ritmo < 0 ? "var(--red)" : "var(--green)"} label={t.statPerPeriod} value={oculto ? "••" : `${simboloPropio} ${Math.round(ahorroStats.ritmo).toLocaleString("es-AR")}`} />
        <MiniStat basis="1 1 0" center color={ahorroStats.ritmo < 0 ? "var(--red)" : "var(--green)"} label={t.statProjection} value={oculto ? "••••" : `${simboloPropio} ${Math.round(ahorroStats.proyeccion).toLocaleString("es-AR")}`} />
        {progresoPropia?.periodos != null && (
          <MiniStat basis="1 1 0" center color="var(--green)" label={t.statToGoal} value={progresoPropia.periodos === 0 ? t.reached : `${progresoPropia.periodos} ${t.periodsShort}`} />
        )}
      </div>
    </div>
  ) : null;

  const mejorPeorCard = ahorroStats && ahorroStats.mejor.periodoId !== ahorroStats.peor.periodoId ? (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="label" style={{ marginBottom: 14 }}>{t.yourPeriods}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, borderRadius: "var(--radius-sm)", padding: "13px 14px", background: "var(--green-dim)", border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--green)" }}>{t.bestPeriod}</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1, margin: "7px 0 3px", color: "var(--green)" }}>{oculto ? "••" : `+${simboloPropio} ${Math.round(ahorroStats.mejor.delta).toLocaleString("es-AR")}`}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{mesDePeriodo(ahorroStats.mejor.periodoId)}</div>
        </div>
        <div style={{ flex: 1, borderRadius: "var(--radius-sm)", padding: "13px 14px", background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)" }}>{t.weakestPeriod}</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1, margin: "7px 0 3px", color: ahorroStats.peor.delta < 0 ? "var(--red)" : "var(--text)" }}>{oculto ? "••" : `${ahorroStats.peor.delta >= 0 ? "+" : "−"}${simboloPropio} ${Math.abs(Math.round(ahorroStats.peor.delta)).toLocaleString("es-AR")}`}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{mesDePeriodo(ahorroStats.peor.periodoId)}</div>
        </div>
      </div>
    </div>
  ) : null;

  // Fila del historial FX (usada dentro del panel). moneda determina los tipos de movimiento.
  const renderFila = (m: Movimiento, moneda: "USD" | "EUR") => {
    const esRetiro = m.tipo === (moneda === "EUR" ? "GastoEUR" : "GastoUSD");
    const esVenta = m.tipo === (moneda === "EUR" ? "VentaEUR" : "VentaUSD");
    const esIngreso = m.tipo === (moneda === "EUR" ? "IngresoEUR" : "IngresoUSD");
    const esSalida = esRetiro || esVenta;
    // Solo ingresos y gastos de divisa se pueden borrar con swipe: no aparecen en Movimientos,
    // así que este es su único acceso. Compras y ventas se editan desde Movimientos como el resto.
    const borrable = esIngreso || esRetiro;
    // Al tocar la fila se abre el detalle SIN cerrar el panel: al salir del modal se vuelve
    // a la lista donde estabas, en vez de caer en la pantalla de Inversión.
    const fila = (
      <div className="row" onClick={() => setModal({ mode: "edit", mov: m })} style={{ cursor: "pointer" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
          {esVenta
            ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.sell}{m.cotizacion ? ` · ${t.rate} $${m.cotizacion.toLocaleString("es-AR")}` : ""}</div>
            : esRetiro
            ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.removeReserve}</div>
            : esIngreso
            ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.fxIncome}</div>
            : m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.rate} ${m.cotizacion.toLocaleString("es-AR")}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: esVenta ? "var(--red)" : esRetiro ? "var(--blue)" : esIngreso ? "var(--green)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
            {esSalida ? "−" : "+"}{oculto ? "••" : m.cantidadUSD?.toFixed(2)}
          </div>
          {!esRetiro && !esIngreso && <div style={{ fontSize: 10, color: esVenta ? "var(--green)" : "var(--muted)" }}>{esVenta ? "+" : ""}{money(m.monto)}</div>}
        </div>
      </div>
    );
    if (!borrable) return <div key={m.id}>{fila}</div>;
    return (
      // El gesto es continuo (fondo rojo + tacho que acompañan el dedo), pero acá sigue
      // pidiendo confirmación: borrar una operación de divisa mueve el patrimonio.
      <SwipeAway key={m.id} onDelete={() => setFxDelete(m)} deleteLabel={t.delete} confirma>
        {fila}
      </SwipeAway>
    );
  };

  return (
    <>
    <div className={`page ${isDesktop ? "page-fluid" : "page-mid"}`}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="fade-up">
          {/* El ícono abre el panel del historial: en escritorio el historial ya se muestra
              completo en el tablero, así que no va. */}
          <PageHeader title={t.portfolio} style={{ marginBottom: 24 }} right={
            showFX && !isDesktop ? (
              <button onClick={() => setHistorialOpen(true)} aria-label={t.usdHistory} style={{ background: "transparent", border: "none", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)", padding: 0 }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <line x1="9" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="9" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="4.5" cy="7" r="1.4" fill="currentColor" />
                  <circle cx="4.5" cy="12" r="1.4" fill="currentColor" />
                  <circle cx="4.5" cy="17" r="1.4" fill="currentColor" />
                </svg>
              </button>
            ) : undefined
          } />
          {showHint && <SectionHint title={t.hintInvTitle} body={t.hintInvBody} onDismiss={dismissHint} />}

          {/* Escritorio: tablero con los números fuera de las cards (ver InvestmentsBoard).
              Móvil: las cards apiladas de siempre. */}
          {isDesktop ? (
            <InvestmentsBoard
              grupos={boardGrupos}
              metas={boardMetas}
              historial={showFX ? (
                <FxHistoryTable
                  movimientos={esEUR ? historialEUR : historialUSD}
                  onDelete={setFxDelete}
                  onVerComprobante={(m) => setViewer({
                    src: m.comprobanteUrl!,
                    isPdf: !!m.comprobantePath?.toLowerCase().endsWith(".pdf"),
                  })}
                />
              ) : undefined}
            />
          ) : (
          <>

          {/* Usuario SIN reserva FX (EUR/USD): patrimonio en su moneda, meta 2da, ritmo y períodos.
              Todo desde la serie ya calculada. Para el ARS estas cards no aplican (usa las FX). */}
          {!showFX && (<>
            {patrimonioPropioCard}
            {metaPropiaCard}
            {ritmoPropioCard}
            {mejorPeorCard}
          </>)}

          {/* ── NET WORTH ── (solo FX/ARS) */}
          {showFX && showNetWorth && (
            <div className="card inv-hero" style={{ background: "linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--green) 8%, var(--surface)) 100%)", border: "1px solid color-mix(in srgb, var(--green) 20%, var(--border))", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="label" style={{ marginBottom: 0 }}>patrimonio</div>
                <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "disponible", value: disponibleActual },
                  { label: "ahorros", value: ahorrosTotales },
                  { label: fxLabel, value: fxEnARS },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "capitalize" }}>{label}</span>
                    <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{oculto ? "••••" : money(value)}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: "color-mix(in srgb, var(--green) 25%, var(--border))", margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 4, textTransform: "capitalize" }}>total</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -1, lineHeight: 1, background: "linear-gradient(110deg, var(--green) 0%, var(--blue) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {oculto ? "••••" : money(totalPatrimonio)}
                  </div>
                  {totalEnUSD !== null && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {oculto ? "≈ U$D ••••" : `≈ U$D ${totalEnUSD.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · oficial`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SECCIÓN USD ── (solo FX/ARS) */}
          {showFX && showUSD && (<>
          <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="label" style={{ marginBottom: 0 }}>{t.usdReserve}</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--yellow)", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
              U$D {oculto ? "••••" : totalUSD.toFixed(2)}
            </div>
            {reservaUSDenARS && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                ≈ {money(reservaUSDenARS)} · {manualOn && !esEUR ? t.rateManual : t.rateOfficial} ${cotizacionUSD?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaUSD !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{t.avgPrice}: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{oculto ? MASK : "$" + costoPromedioUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span></span>
                <span style={{ color: "var(--muted)" }}>{t.profit}: <span style={{ color: gananciaUSD >= 0 ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{oculto ? MASK : `${gananciaUSD >= 0 ? "+" : ""}${money(gananciaUSD)}`}{gananciaPctUSD !== null && !oculto ? ` (${gananciaUSD >= 0 ? "+" : ""}${gananciaPctUSD.toFixed(1)}%)` : ""}</span></span>
              </div>
            )}
          </div>

          </>)}

          {/* ── SECCIÓN EUR ── (solo FX/ARS) */}
          {showFX && showEUR && (<>
          <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="label" style={{ marginBottom: 0 }}>{t.eurReserve}</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--yellow)", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
              € {oculto ? "••••" : totalEUR.toFixed(2)}
            </div>
            {reservaEURenARS && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                ≈ {money(reservaEURenARS)} · {manualOn && esEUR ? t.rateManual : t.rateOfficial} ${cotizacionEUR?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaEUR !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{t.avgPrice}: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{oculto ? MASK : "$" + costoPromedioEUR.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span></span>
                <span style={{ color: "var(--muted)" }}>{t.profit}: <span style={{ color: gananciaEUR >= 0 ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{oculto ? MASK : `${gananciaEUR >= 0 ? "+" : ""}${money(gananciaEUR)}`}{gananciaPctEUR !== null && !oculto ? ` (${gananciaEUR >= 0 ? "+" : ""}${gananciaPctEUR.toFixed(1)}%)` : ""}</span></span>
              </div>
            )}
          </div>


          </>)}

          {/* Meta FX (reserva en divisa) — solo FX/ARS. Mide contra la reserva (totalDisplay). */}
          {showFX && config?.meta.metaFX?.monto && (() => {
            const metaFXMonto = config.meta.metaFX.monto;
            const falta = Math.max(0, metaFXMonto - totalDisplay);
            const pctMeta = Math.min((totalDisplay / metaFXMonto) * 100, 100);
            const metaAlcanzada = falta <= 0;
            const barColor = pctMeta >= 80 ? "var(--green)" : pctMeta >= 40 ? "var(--yellow)" : "var(--red)";
            return (
              <div className="card" style={{ background: "var(--surface)", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="label" style={{ marginBottom: 0 }}>{t.fxGoal}</div>
                    {metaAlcanzada && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.reachedBadge}</span>}
                  </div>
                  {config.meta.metaFX.fecha && <div style={{ fontSize: 9, color: "var(--muted)" }}>{fechaCortaConAnio(config.meta.metaFX.fecha)}</div>}
                </div>

                {/* Objetivo + faltan */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                      {simbolo} {metaFXMonto.toLocaleString("es-AR")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t.remainingLabel}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: metaAlcanzada ? "var(--green)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      {oculto ? "••" : (metaAlcanzada ? "0" : Math.round(falta).toLocaleString("es-AR"))}
                    </div>
                  </div>
                </div>

                {/* Barra */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="progress-track" style={{ flex: 1, margin: 0 }}>
                    <div className="progress-fill" style={{ width: `${pctMeta}%`, background: barColor }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "right" }}>{pctMeta.toFixed(1)}%</span>
                </div>

                {/* Mini-stats */}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  {(() => {
                    const avg = oculto ? "••" : (promAhorroUSD !== null ? Math.round(promAhorroUSD).toLocaleString("es-AR") : "—");
                    const goal = Math.round(metaUSD).toLocaleString("es-AR");
                    // Ritmo negativo = vendiste/gastaste más divisa de la que compraste.
                    const col = (promAhorroUSD ?? 0) < 0 ? "var(--red)" : "var(--yellow)";
                    return (
                    <MiniStat basis="1 1 0" center color={col} label={t.statPerPeriod} value={avg}
                      onClick={() => setKpiInfo({ title: t.statPerPeriod, value: `${avg} / ${goal}`, explain: t.kpiPerPeriodInfo, color: col })} />
                  ); })()}
                  {proyUSD !== null && (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statProjection}
                      value={oculto ? "••••" : Math.round(proyUSD).toLocaleString("es-AR")}
                      onClick={() => setKpiInfo({ title: t.statProjection, value: oculto ? "••••" : `${simbolo} ${Math.round(proyUSD).toLocaleString("es-AR")}`, explain: t.kpiProjectionInfo, color: "var(--yellow)" })} />
                  )}
                  {periodosParaMeta !== null && (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statToGoal}
                      value={periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}`}
                      onClick={() => setKpiInfo({ title: t.statToGoal, value: periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}`, explain: t.kpiToGoalInfo, color: "var(--yellow)" })} />
                  )}
                </div>
                {/* Ritmo vs fecha objetivo: mismo criterio que la meta propia — silencio si vas
                    bien, solo avisa si el ritmo actual no alcanza para llegar a tiempo. */}
                {vaAtrasadoFX && ritmoNecesarioFX !== null && (
                  <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 6 }}>
                    {t.goalBehindPace(`${simbolo} ${Math.round(ritmoNecesarioFX).toLocaleString("es-AR")}`, fechaCortaConAnio(config.meta.metaFX.fecha ?? ""))}
                  </div>
                )}
                {/* Simulador FX: la perilla es COMPRAR más divisa por período (en la unidad de
                    la reserva), no ahorrar pesos. Solo si todavía falta. */}
                {metaMonto != null && totalDisplay < metaMonto && (
                  <SimuladorMeta
                    faltante={metaMonto - totalDisplay}
                    ritmo={ritmoFX}
                    color="var(--yellow)"
                    formatMonto={(n) => `${simbolo} ${Math.round(n).toLocaleString("es-AR")}`}
                    perillas={[{ label: t.simBuyMore, control: t.simBuyPerPeriod, max: Math.max(500, Math.ceil((ritmoFX || 100) * 3)), step: 50 }]}
                  />
                )}
              </div>
            );
          })()}

          {/* Meta de ahorro al final para el usuario ARS con reserva FX. */}
          {showFX && metaPropiaCard}

          </>
          )}
        </div>
      )}
    </div>

    {/* Panel de historial FX — accedido por el ícono de reloj en el header */}
    {historialOpen && showFX && (
      <div onClick={() => setHistorialOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "color-mix(in srgb, var(--bg) 60%, transparent)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div onClick={(e) => e.stopPropagation()} className="fade-up" style={{ background: "var(--surface)", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTop: "1px solid var(--border)", padding: 16, maxHeight: "82vh", overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="label" style={{ marginBottom: 0 }}>{t.reserve}</div>
            <button onClick={() => setHistorialOpen(false)} aria-label={t.close} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>

          {showUSD && historialUSD.length > 0 && (
            <div style={{ marginBottom: historialEUR.length > 0 ? 18 : 0 }}>
              {historialEUR.length > 0 && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>U$D</div>}
              {historialUSD.map((m) => renderFila(m, "USD"))}
            </div>
          )}
          {showEUR && historialEUR.length > 0 && (
            <div>
              {historialUSD.length > 0 && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>EUR</div>}
              {historialEUR.map((m) => renderFila(m, "EUR"))}
            </div>
          )}

          {/* Cargar reserva vive acá dentro: fuera del panel se carga desde los atajos de Inicio. */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button onClick={() => { setHistorialOpen(false); setModal({ mode: "add" }); }} aria-label={t.reserve} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--green)", cursor: "pointer", padding: 8, filter: "drop-shadow(0 2px 12px var(--green)99)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>
        </div>
      </div>
    )}

    <MovementModal
      open={modal !== null}
      mode={modal?.mode === "edit" ? "edit" : "add"}
      reserveMode={modal?.mode === "add"}
      readOnly={modal?.mode === "edit"}
      movimiento={modal?.mode === "edit" ? modal.mov : null}
      movimientos={movimientos}
      config={config}
      onClose={() => setModal(null)}
      onChanged={refreshData}
      onCreated={prependMovimiento}
      onUpdated={updateMovimiento}
      onDeleted={removeMovimiento}
    />
    {kpiInfo && <KpiInfoModal title={kpiInfo.title} value={kpiInfo.value} explain={kpiInfo.explain} color={kpiInfo.color} onClose={() => setKpiInfo(null)} />}
    {viewer && <MediaViewer src={viewer.src} isPdf={viewer.isPdf} onClose={() => setViewer(null)} />}
    {fxDelete && (
      <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)" loading={fxDeleting}
        onCancel={() => setFxDelete(null)}
        onConfirm={async () => {
          if (!user?.uid) return;
          setFxDeleting(true);
          try {
            await eliminarMovimiento(user.uid, fxDelete.id);
            removeMovimiento(fxDelete.id);
            setFxDelete(null);
          } finally { setFxDeleting(false); }
        }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>{t.deleteMovementTitle}</div>
          <div style={{ fontSize: 18, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 8 }}>
            {fxDelete.tipo.startsWith("Gasto") ? "−" : "+"}{fxDelete.cantidadUSD?.toFixed(2)}
          </div>
          <div style={{ fontSize: 11 }}>{t.actionIrreversible}</div>
        </div>
      </ConfirmModal>
    )}
    </>
  );
}
