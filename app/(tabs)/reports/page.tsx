"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { useHint } from "@/hooks/useHint";
import { useInflacionIPC } from "@/hooks/useInflacionIPC";
import { useDolarHistorico } from "@/hooks/useDolarHistorico";
import { SectionHint } from "@/components/ui/SectionHint";
import { YearWrapped, wrappedYears } from "@/components/reports/YearWrapped";
import { RecapPeriodo } from "@/components/reports/RecapPeriodo";
import { recapDisponible } from "@/utils/recap-periodo";
import { leerNotifyMeta, guardarNotifyMeta } from "@/services/firebase/notificaciones";
import { useData } from "../data-context";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { agruparPorPeriodo, gastosPorCategoria } from "@/utils/periodo";
import { agruparGastosPorDescripcion } from "@/utils/agrupar-gastos";
import { ahoraAR } from "@/utils/fecha-ar";
import { balancePresupuesto } from "@/utils/presupuesto-tope";
import { obtenerPresupuesto, guardarPresupuesto } from "@/services/firebase/presupuestos";
import { useMoney } from "@/hooks/useHideValues";
import {
  gastosPorMedioPago, gastosPorDescripcion,
  kpisPeriodo, ritmoGasto, comparativaCategorias, anomaliasCategorias,
  serieTendencia, parsePeriodoId, diasSinGastos,
  historialSueldo, proyectarAhorros, ritmoAhorro,
  progresoMetaUSD, periodosParaMetaUSD, estadisticasPeriodos,
  inflacionPersonal as calcInflacionPersonal,
} from "@/utils/reportes";
import { afectaDisponible } from "@/utils/movement-fx";
import { reservaFX as calcularReservaFX } from "@/utils/reserva";
import { PageHeader } from "@/components/ui/PageHeader";
import { APP_GRAD_DIM, appGradText } from "@/components/ui/gradients";
import { abbr, shortPer, sinAño, periodoAnio, TIPO_COLOR } from "@/components/reports/format";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MovimientosTab } from "@/components/reports/MovimientosTab";
import { IngresosTab } from "@/components/reports/IngresosTab";
import { GastosTab } from "@/components/reports/GastosTab";
import { PeriodosTab } from "@/components/reports/PeriodosTab";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CenterCard } from "@/components/ui/CenterCard";
import { SwipeTabs } from "@/components/ui/SwipeTabs";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { PeriodCompare } from "@/components/desktop/PeriodCompare";

type Sub = "gastos" | "ingresos" | "movimientos" | "periodos";

// Gradiente de marca unificado para todos los selectores (blue → cyan → teal → green)
const gradText = appGradText;
const pillOn: React.CSSProperties = { border: "1px solid transparent", background: APP_GRAD_DIM };
const pillOff: React.CSSProperties = { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)" };

// ── Página ───────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const t = useT();
  const SUBS: { id: Sub; label: string }[] = [
    { id: "gastos",       label: t.tabExpenses },
    { id: "ingresos",     label: t.tabIncome },
    { id: "movimientos",  label: t.tabMovements },
    { id: "periodos",     label: t.tabPeriods },
  ];
  const { user } = useAuth();
  const { oculto, m: money } = useMoney();
  const { movimientos, loading, config } = useData();
  const { cotizacion } = useCotizacion();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const [showHint, dismissHint] = useHint("swipeTabs");

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const [sub, setSub] = useState<Sub>("gastos");
  // En escritorio, elegir 2+ períodos muestra la comparación lado a lado.
  const isDesktop = useIsDesktop();
  // Progreso del swipe entre subtabs (∈ [-1,1], <0 hacia el siguiente) para que el
  // indicador de las pills acompañe el dedo en vivo.
  const [dragP, setDragP] = useState(0);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  // El Wrapped (resumen anual) solo se ofrece en la VENTANA de fin de año: 5 días antes del
  // 31/12 y 5 después (26/12 → 5/1). Fuera de esa ventana no aparece, aunque haya datos.
  const hayWrapped = useMemo(() => {
    if (wrappedYears(movimientos).length === 0) return false;
    const ar = ahoraAR();
    const m = ar.getUTCMonth() + 1, d = ar.getUTCDate();
    return (m === 12 && d >= 26) || (m === 1 && d <= 5);
  }, [movimientos]);
  // Recap del período que cerró: aparece cuando abrís un período nuevo y queda hasta que lo
  // veas UNA vez (como una notificación). Tiene PRIORIDAD sobre el Wrapped anual en el botón.
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapVisto, setRecapVisto] = useState<string | undefined>(undefined);
  // Hasta que no sepamos qué recap ya se vio, NO se decide: si no, el botón aparece con
  // recapVisto=undefined (cree que no lo viste) y desaparece al llegar la lectura → parpadeo.
  const [metaCargado, setMetaCargado] = useState(false);
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    leerNotifyMeta(uid)
      .then((meta) => setRecapVisto(meta.inApp.recapVisto))
      .catch(() => {})
      .finally(() => setMetaCargado(true));
  }, [user?.uid]);
  // ?recap=1 fuerza mostrarlo aunque ya se haya visto (atajo para revisarlo cuando quieras
  // sin cerrar un período real). Se deja a propósito: es inofensivo.
  const forzarRecap = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("recap") === "1";
  const recap = useMemo(
    () => ((metaCargado || forzarRecap) ? recapDisponible(agruparPorPeriodo(movimientos), forzarRecap ? undefined : recapVisto) : null),
    [movimientos, recapVisto, metaCargado, forzarRecap]
  );
  // Al abrir el recap se marca como visto: no vuelve a ofrecerse hasta el próximo cierre.
  const abrirRecap = () => {
    setRecapOpen(true);
    const uid = user?.uid;
    if (uid && recap) {
      setRecapVisto(recap.periodoId);
      leerNotifyMeta(uid).then((meta) => guardarNotifyMeta(uid, { ...meta.inApp, recapVisto: recap.periodoId }, meta.budgetAvisos)).catch(() => {});
    }
  };
  const [periodosSelIds, setPeriodosSelIds] = useState<string[]>([]);
  const [modalTop, setModalTop] = useState<"gastos" | "descs" | "movcat" | null>(null);
  const [kpiInfo, setKpiInfo] = useState<{ title: string; value: string; explain: string; color?: string } | null>(null);
  const [navPeriodo, setNavPeriodo] = useState<{ periodoId: string; target: Sub } | null>(null);
  const [modalSueldo, setModalSueldo] = useState(false);
  const [modalAhorros, setModalAhorros] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [presupuesto, setPresupuesto] = useState<Record<string, number> | null>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [modalBudget, setModalBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Record<string, string>>({});
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [catModal, setCatModal] = useState<string | null>(null);
  // Misma idea que catModal pero leyendo del período ANTERIOR: es el detalle de una fila de
  // "vs período anterior", donde lo que se quiere ver es en qué se fue la plata ENTONCES.
  const [catAnteriorModal, setCatAnteriorModal] = useState<string | null>(null);
  const [medioModal, setMedioModal] = useState<string | null>(null);
  const [periodMetric, setPeriodMetric] = useState<"gasto" | "ingreso" | "dias" | "gastoSueldo" | "inflacion" | "sueldoReal">("gasto");
  const [sueldoRealMode, setSueldoRealMode] = useState<"USD" | "IPC">("USD");
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);
  const { deflatar, ipcVar, ipcMensualUltimo } = useInflacionIPC();
  const { dolarAt } = useDolarHistorico();
  // El IPC (deflactor y factor de proyección) es argentino: solo aplica si la moneda es ARS.
  const esARS = monedaPrincipal === "ARS";
  const [selectedMovTipo, setSelectedMovTipo] = useState<string | null>(null);

  // Multi-select: si no hay selección, usa el primero
  const activos = periodosSelIds.length > 0 ? periodosSelIds : [periodos[0]?.periodoId].filter(Boolean);
  const periodosActivos = periodos.filter((p) => activos.includes(p.periodoId));
  // Tendencia y proyección sólo tienen sentido en el período vigente (el más reciente).
  const esPeriodoVigente = activos.length === 1 && activos[0] === periodos[0]?.periodoId;

  // Combina todos los períodos seleccionados en uno virtual. Memoizado: se usa como
  // dependencia de otros useMemo más abajo, y sin esto era un objeto nuevo en cada render.
  const periodo = useMemo(() => periodosActivos.length > 0 ? {
    periodoId: activos.length === 1 ? activos[0]! : t.virtualPeriods(activos.length),
    sueldo: periodosActivos.reduce((sum, p) => sum + p.sueldo, 0),
    extras: periodosActivos.reduce((sum, p) => sum + p.extras, 0),
    total: periodosActivos.reduce((sum, p) => sum + p.total, 0),
    gastado: periodosActivos.reduce((sum, p) => sum + p.gastado, 0),
    gastadoPuro: periodosActivos.reduce((sum, p) => sum + p.gastadoPuro, 0),
    ahorros: periodosActivos.reduce((sum, p) => sum + p.ahorros, 0),
    resto: periodosActivos.reduce((sum, p) => sum + p.resto, 0),
    disponible: periodosActivos.reduce((sum, p) => sum + p.disponible, 0),
    moveDisponible: periodosActivos.reduce((sum, p) => sum + p.moveDisponible, 0),
    moveAhorros: periodosActivos.reduce((sum, p) => sum + p.moveAhorros, 0),
    pct: periodosActivos.length > 0 ? Math.round((periodosActivos.reduce((sum, p) => sum + p.gastado, 0) / periodosActivos.reduce((sum, p) => sum + p.total, 0)) * 100) : 0,
    movimientos: periodosActivos.flatMap((p) => p.movimientos),
  } : undefined, [periodosActivos, activos, t]);

  // Para comparativa y ritmo, usa el primer período (sólo si es un período individual)
  const idx1 = activos.length === 1 && activos[0] ? periodos.findIndex((p) => p.periodoId === activos[0]) : -1;
  const anterior = idx1 >= 0 ? periodos[idx1 + 1] : undefined;
  // finPeriodo = inicio del período siguiente (si existe), para cerrar el intervalo correctamente
  const finPeriodo = idx1 > 0 ? parsePeriodoId(periodos[idx1 - 1].periodoId) : null;

  // ── Cálculos del período seleccionado (sub Gastos) ──
  const cats = periodo ? gastosPorCategoria(periodo.movimientos, periodo.gastado) : [];
  const medios = periodo ? gastosPorMedioPago(periodo.movimientos, periodo.gastado) : [];
  const descs = periodo ? gastosPorDescripcion(periodo.movimientos, periodo.gastado, 5) : [];
  const descsModal = periodo ? gastosPorDescripcion(periodo.movimientos, periodo.gastado, 20) : [];
  // Descripciones que provienen de compras de divisa → su barra va en amarillo (el resto, gasto → rojo).
  const descsCompra = useMemo(() => {
    const s = new Set<string>();
    for (const m of (periodo?.movimientos ?? [])) {
      if (m.tipo === "CompraUSD" || m.tipo === "CompraEUR") s.add(m.descripcion || "—");
    }
    return s;
  }, [periodo]);
  const esCatCompra = (cat: string) => cat === "CompraUSD" || cat === "CompraEUR";
  const kpis = periodo ? kpisPeriodo(periodo) : null;
  // Ritmo y comparativa sólo aplican a un período individual
  const ritmo = periodo && activos.length === 1 ? ritmoGasto(periodo, finPeriodo) : null;
  const comp = periodo && activos.length === 1 ? comparativaCategorias(periodo, anterior) : [];
  // Anomalía: actual vs el PROMEDIO de los 3 períodos anteriores (no solo el inmediato, que es
  // un dato ruidoso). Mismos períodos que anterior, solo que toma 3 en vez de 1.
  const anomalias = periodo && activos.length === 1 && idx1 >= 0
    ? anomaliasCategorias(periodo, periodos.slice(idx1 + 1), 3)
    : [];

  // ── Estadísticas avanzadas (Gastos) ──
  const promPorMov = periodo ? (() => {
    const n = periodo.movimientos.filter((m) => m.tipo === "Gasto").length;
    return n > 0 ? periodo.gastadoPuro / n : null;
  })() : null;
  const diasLibres = periodo ? (() => {
    if (activos.length === 1) {
      const start = parsePeriodoId(activos[0]!);
      const end = finPeriodo ?? new Date();
      return diasSinGastos(periodo.movimientos, start, end);
    }
    const agg = periodosActivos.map((p, i) => {
      const start = parsePeriodoId(p.periodoId);
      const idxInAll = periodos.findIndex((x) => x.periodoId === p.periodoId);
      const end = idxInAll > 0 ? parsePeriodoId(periodos[idxInAll - 1].periodoId) : new Date();
      return diasSinGastos(p.movimientos, start, end);
    });
    return { sinGasto: agg.reduce((s, d) => s + d.sinGasto, 0), total: agg.reduce((s, d) => s + d.total, 0) };
  })() : null;
  const catMasCrecio = comp.filter((c) => c.deltaPct !== null && c.deltaPct > 0).sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0] ?? null;


  // ── Ingresos ──
  // Ingresos a disponible (Sueldo + Extras). Moves son transferencias internas.
  // `fecha` es YYYY-MM-DD → comparable como string (más nuevo primero).
  const porFechaDesc = (a: { fecha: string }, b: { fecha: string }) => (b.fecha || "").localeCompare(a.fecha || "");
  const movIngresos = periodo
    ? periodo.movimientos
        .filter((m) =>
          m.tipo === "Ingreso" && m.categoria !== "Ahorros" && m.categoria !== "RESTO"
        )
        .sort(porFechaDesc)
    : [];

  // Ingresos que fueron directo a ahorros (dinero real que entró pero no pasó por disponible)
  const movIngresosAhorros = periodo
    ? periodo.movimientos
        .filter((m) => m.tipo === "Ingreso" && m.categoria === "Ahorros")
        .sort(porFechaDesc)
    : [];

  // RESTO (arrastre del período anterior, ahora Move/aAhorro · antes Ingreso/RESTO).
  // Solo para MOSTRAR en el detalle "directo a ahorros" — NO entra en ningún total/KPI.
  const movResto = periodo
    ? periodo.movimientos
        .filter((m) => m.categoria === "RESTO")
        .sort(porFechaDesc)
    : [];

  const totalIngresos = periodo ? periodo.sueldo + periodo.moveDisponible : 0;
  const totalAhorradoDirecto = movIngresosAhorros.reduce((s, m) => s + m.monto, 0);

  const ingXCat: { cat: string; monto: number; pct: number }[] = (() => {
    if (!periodo) return [];
    const catMap = new Map<string, number>();
    if (periodo.sueldo > 0) catMap.set("Sueldo", periodo.sueldo);
    if (periodo.moveDisponible > 0) catMap.set("Move disponible", periodo.moveDisponible);
    for (const m of periodo.movimientos) {
      if (m.tipo === "Ingreso" && m.categoria !== "RESTO" && m.categoria !== "Sueldo") {
        catMap.set(m.categoria, (catMap.get(m.categoria) ?? 0) + m.monto);
      }
    }
    const totalCat = totalIngresos + totalAhorradoDirecto;
    return Array.from(catMap.entries())
      .filter(([, v]) => v > 0)
      .map(([cat, monto]) => ({ cat, monto, pct: totalCat > 0 ? Math.round((monto / totalCat) * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto);
  })();

  const ingresosAnteriores = anterior ? anterior.sueldo + anterior.moveDisponible : 0;
  const deltaIngresos = anterior && ingresosAnteriores > 0
    ? ((totalIngresos - ingresosAnteriores) / ingresosAnteriores) * 100
    : null;

  const ingXDesc: { cat: string; monto: number; pct: number }[] = (() => {
    if (!periodo) return [];
    const descMap = new Map<string, number>();
    for (const m of periodo.movimientos) {
      // Incluye todos los ingresos reales: Sueldo y RESTO (período anterior, ahora Move/aAhorro)
      if (m.tipo === "Ingreso" || m.categoria === "RESTO") {
        const key = m.categoria === "RESTO" ? t.prevPeriodRemaining : (m.descripcion || m.categoria);
        descMap.set(key, (descMap.get(key) ?? 0) + m.monto);
      }
    }
    const totalAll = totalIngresos + totalAhorradoDirecto;
    return Array.from(descMap.entries())
      .filter(([, v]) => v > 0)
      .map(([cat, monto]) => ({ cat, monto, pct: totalAll > 0 ? Math.round((monto / totalAll) * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto);
  })();

  const evolucionIngresos = useMemo(
    () => periodos.slice(0, 12),
    [periodos]
  );

  // ── Estadísticas avanzadas ──
  // Sueldo del período activo (no del más reciente) + variación vs el nivel salarial previo.
  const evolSueldoActivo = useMemo(() => {
    if (!periodo) return null;
    const ultimo = periodo.sueldo;
    if (activos.length !== 1) return { sueldo: ultimo, deltaPct: null as number | null, esVacaciones: false };
    const maxSueldo = Math.max(...periodos.map((p) => p.sueldo), 0);
    const esVac = (s: number) => s > 0 && s < maxSueldo * 0.5;
    const idx = periodos.findIndex((p) => p.periodoId === activos[0]);
    const ref = idx >= 0 ? periodos.slice(idx + 1).find((p) => p.sueldo > 0 && !esVac(p.sueldo) && p.sueldo !== ultimo) : undefined;
    const anteriorS = ref?.sueldo ?? null;
    const deltaPct = anteriorS ? Math.round(((ultimo - anteriorS) / anteriorS) * 100) : null;
    return { sueldo: ultimo, deltaPct, esVacaciones: esVac(ultimo) };
  }, [periodo, activos, periodos]);
  const suelHistorial = useMemo(() => historialSueldo(periodos), [periodos]);

  // ── Tendencias ──
  const seedPeriodoId = config?.meta.ahorrosAcumSeedPeriodoId;

  // Auto-guardar seed la primera vez que carga con períodos pero sin seed: se ancla al PRIMER
  // período con movimientos para que los promedios usen toda la historia del usuario (antes
  // tomaba el anteúltimo y descartaba el resto). Es el origen común a ahorros y reserva FX.
  useEffect(() => {
    if (!user?.uid || !config || seedPeriodoId || periodos.length === 0) return;
    const newSeedId = periodos[periodos.length - 1]?.periodoId; // periodos[0] es el más nuevo
    if (!newSeedId) return;
    updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.ahorrosAcumSeedPeriodoId": newSeedId });
  }, [user?.uid, !!config, !!seedPeriodoId, periodos.length]);

  // Cargar presupuesto del período activo (solo si hay un único período seleccionado). Al
  // cambiar de período hay que ir a buscar su presupuesto a Firestore — sincronizar con ese
  // fetch es el uso de efecto que React documenta como correcto; showBudget se resetea junto
  // porque el presupuesto mostrado ya no corresponde al período nuevo hasta que llegue.
  const activoPeriodoId = activos.length === 1 ? (activos[0] ?? null) : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowBudget(false);
    if (!user?.uid || !activoPeriodoId) { setPresupuesto(null); return; }
    obtenerPresupuesto(user.uid, activoPeriodoId).then(setPresupuesto).catch(() => setPresupuesto(null));
  }, [user?.uid, activoPeriodoId]);

  // Plantilla por defecto: en el período en curso, si no hay presupuesto propio guardado,
  // se aplica sola como presupuesto efectivo (sin persistir hasta que el usuario edite/guarde).
  const presupuestoTemplate = config?.meta.presupuestoTemplate ?? null;
  const templateValido = presupuestoTemplate && Object.keys(presupuestoTemplate).length > 0 ? presupuestoTemplate : null;
  const presupuestoEfectivo = presupuesto ?? (esPeriodoVigente ? templateValido : null);
  // Categorías del editor: unión de las que ya tienen gasto + las de la plantilla/presupuesto,
  // así en un período nuevo (sin gastos) igual aparecen todas para editar.
  const catsEditables = Array.from(new Set([
    ...cats.map((c) => c.categoria),
    ...Object.keys(presupuesto ?? {}),
    ...Object.keys(templateValido ?? {}),
  ]));
  // Con presupuesto visible, sumá las categorías presupuestadas que aún no tienen gasto
  // (monto 0) para ver el presupuesto completo, no solo lo ya gastado.
  const catsConPresu = showBudget && presupuestoEfectivo
    ? [...cats, ...Object.keys(presupuestoEfectivo)
        .filter((cat) => (presupuestoEfectivo[cat] ?? 0) > 0 && !cats.some((c) => c.categoria === cat))
        .map((cat) => ({ categoria: cat, monto: 0, pct: 0 }))]
    : cats;

  const serie = useMemo(() => serieTendencia(periodos, seedPeriodoId), [periodos, seedPeriodoId]);
  const serieDesc = useMemo(() => [...serie].reverse(), [serie]);
  const maxTotal = Math.max(...serie.map((s) => s.total), 1);

  // ── Resumen general de períodos ──
  // Excluye el período en curso (incompleto): gastó poco solo porque recién arranca,
  // no es "el mejor". Mismo criterio que inflación/tendencia.
  const validPeriodos = useMemo(() => serieDesc.filter((s) => s.total > 0 && s.periodoId !== periodos[0]?.periodoId), [serieDesc, periodos]);
  const mejorPeriodo = validPeriodos.length > 0 ? validPeriodos.reduce((b, s) => s.gastado / s.total < b.gastado / b.total ? s : b) : null;
  const peorPeriodo = validPeriodos.length > 0 ? validPeriodos.reduce((b, s) => s.gastado / s.total > b.gastado / b.total ? s : b) : null;
  // Inflación personal: variación promedio del gasto puro (sin compras de divisa,
  // que dispararían el número) entre períodos consecutivos.
  // Misma fórmula exacta que Inicio (helper compartido): promedio de variaciones
  // reales del gasto puro, deflactadas por IPC en ARS.
  const inflacionPersonal = useMemo(
    () => calcInflacionPersonal(periodos, monedaPrincipal === "ARS" ? deflatar : undefined),
    [periodos, deflatar, monedaPrincipal],
  );
  // Gasto más frecuente: categoría con más movimientos de tipo Gasto + su total acumulado.
  // ¿Tu sueldo le gana a la inflación? Suba salarial acumulada (primer nivel → último,
  // sin contar vacaciones) vs inflación país acumulada en toda tu historia.
  const sueldoVsInflacion = useMemo(() => {
    if (suelHistorial.length === 0 || periodos.length < 2) return null;
    const firstSalary = suelHistorial[suelHistorial.length - 1]!.de;
    const lastSalary = suelHistorial[0]!.a;
    if (firstSalary <= 0) return null;
    const suba = (lastSalary / firstSalary - 1) * 100;
    const pais = ipcVar(periodos[periodos.length - 1]!.periodoId, periodos[0]!.periodoId);
    if (pais == null) return null;
    return { gap: suba - pais, suba: Math.round(suba), pais: Math.round(pais) };
  }, [suelHistorial, periodos, ipcVar]);

  // Ahorros acumulados al cierre del período seleccionado (para mostrar en Períodos)
  const ahorrosAcumPeriodo = activos.length === 1
    ? (serie.find((s) => s.periodoId === activos[0])?.ahorrosAcum ?? 0)
    : serie[serie.length - 1]?.ahorrosAcum ?? 0;
  const ahorrosAcumAnterior = anterior
    ? (serie.find((s) => s.periodoId === anterior.periodoId)?.ahorrosAcum ?? 0)
    : 0;
  const deltaAhorros = ahorrosAcumPeriodo > 0 && anterior ? ahorrosAcumPeriodo - ahorrosAcumAnterior : null;
  const deltaAhorrosPct = deltaAhorros !== null && ahorrosAcumAnterior > 0
    ? Math.round((deltaAhorros / ahorrosAcumAnterior) * 100)
    : null;

  // ── Tendencias / metas de ahorro ──
  const cotizActual = monedaInversiones === "EUR"
    ? (cotizacion?.oficial_euro ?? null)
    : (cotizacion?.oficial ?? null);
  const simBoloInv = monedaInversiones === "EUR" ? "€" : "U$D";

  // Reserva real en FX (misma cuenta que página Inversión): solo movimientos, sin saldo inicial.
  const reservaFX = useMemo(
    () => Math.max(0, calcularReservaFX(movimientos, monedaInversiones === "EUR" ? "EUR" : "USD")),
    [movimientos, monedaInversiones]
  );

  const metaMonto = config?.meta.metaMonto;
  const progresoMeta = metaMonto && cotizActual ? progresoMetaUSD(reservaFX * cotizActual, metaMonto, cotizActual) : null;
  const periodosParaMetaMonto = metaMonto && cotizActual ? periodosParaMetaUSD(serie, metaMonto, cotizActual, esARS ? deflatar : undefined, seedPeriodoId) : null;
  const ahorrosEnUSD = reservaFX > 0 ? reservaFX : null;
  const promAhorroUSD = cotizActual && serie.length > 0
    ? (serie.reduce((s, p) => s + Math.max(0, p.ahorros), 0) / serie.length) / cotizActual : null;
  const proyUSD = cotizActual && serie.length >= 2 ? proyectarAhorros(serie, 3, esARS ? deflatar : undefined, seedPeriodoId) / cotizActual : null;

  // ── Tendencias: Gastos ──
  const promGastoPorPeriodo = periodos.length > 0
    ? Math.round(periodos.reduce((s, p) => s + p.gastadoPuro, 0) / periodos.length) : 0;
  // Mediana por período (más robusta que el promedio ante períodos atípicos).
  const mediana = (arr: number[]) => {
    const v = arr.filter((x) => x > 0).sort((a, b) => a - b);
    if (v.length === 0) return 0;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
  };
  const medianaGastoPeriodo = useMemo(() => mediana(periodos.map((p) => p.gastadoPuro)), [periodos]);
  // Lo que entró a ahorros por período: depósitos (moveAhorros) + ingresos directos a ahorro.
  const medianaAhorroPeriodo = useMemo(() => mediana(periodos.map((p) => p.moveAhorros + p.ahorros)), [periodos]);
  // Proyección de ahorro del próximo período: usa el ritmo unificado (ahorro NETO, últimos
  // VENTANA_PERIODOS cerrados, deflactado) y lo lleva al próximo período con el IPC mensual.
  // Antes promediaba el ahorro BRUTO sobre todo el histórico y no coincidía con Inversión.
  const proyeccionAhorro = (() => {
    const ritmo = ritmoAhorro(serie, esARS ? deflatar : undefined, seedPeriodoId);
    if (ritmo === null) return null;
    // El factor lleva un ahorro POSITIVO a pesos del próximo período. No se aplica si:
    //  - el ritmo es negativo (la inflación no hace que desahorres más), ni
    //  - la moneda no es ARS (el IPC argentino no rige un ahorro en USD/EUR — igual que
    //    el deflactor de arriba, que ya queda en identidad).
    const factor = ritmo > 0 && esARS && ipcMensualUltimo != null ? 1 + ipcMensualUltimo / 100 : 1;
    return Math.round(ritmo * factor);
  })();
  const estadPeriodos = useMemo(() => estadisticasPeriodos(periodos), [periodos]);
  const avgHistorico = periodos.length >= 2
    ? periodos.slice(1).reduce((s, p) => s + p.gastadoPuro, 0) / (periodos.length - 1) : 0;
  const tendenciaGasto = periodos.length >= 2 && avgHistorico > 0
    ? ((periodos[0].gastadoPuro - avgHistorico) / avgHistorico) * 100 : null;
  // Proyección de gasto del próximo período: mezcla el promedio histórico (base estable) con
  // el ritmo del período EN CURSO (reactivo a cómo venís gastando ahora). Solo con el promedio
  // el número no se movía nunca — los períodos cerrados ya no cambian; solo con el ritmo actual
  // sería muy volátil al arranque del período, cuando pocos días pesan demasiado.
  // El peso del período en curso crece con los días transcurridos (tope 50%): al principio casi
  // no influye, a mitad de período pesa la mitad.
  const proyeccionGasto = periodos.length >= 2 ? (() => {
    // Histórico: períodos cerrados desde el seed, deflactados a pesos de hoy (los viejos valían
    // "menos pesos" y subestimaban). IPC solo en ARS: en USD/EUR no aplica el índice argentino.
    const seedIdx = seedPeriodoId ? periodos.findIndex((p) => p.periodoId === seedPeriodoId) : periodos.length - 1;
    const hist = periodos.slice(1, (seedIdx >= 0 ? seedIdx : periodos.length - 1) + 1);
    if (hist.length === 0) return null;
    const realAvg = hist.reduce((s, p) => s + (esARS ? deflatar(p.gastadoPuro, p.periodoId) : p.gastadoPuro), 0) / hist.length;
    const factor = esARS && ipcMensualUltimo != null ? 1 + ipcMensualUltimo / 100 : 1;
    const base = realAvg * factor;

    // Ritmo del período en curso extrapolado a período completo.
    const enCurso = periodos[0];
    const ritmo = ritmoGasto(enCurso, null);
    if (!ritmo.enCurso || ritmo.diasTranscurridos < 3) return Math.round(base); // muy temprano: solo histórico
    const peso = Math.min(0.5, ritmo.diasTranscurridos / 60);
    return Math.round(base * (1 - peso) + ritmo.proyeccionCierre * peso);
  })() : null;
  const avgHistoricoMovs = periodos.length >= 2
    ? periodos.slice(1).reduce((s, p) => s + p.movimientos.length, 0) / (periodos.length - 1) : 0;
  const tendenciaMovs = periodos.length >= 2 && avgHistoricoMovs > 0
    ? ((periodos[0].movimientos.length - avgHistoricoMovs) / avgHistoricoMovs) * 100 : null;

  // ── Movimientos: estadísticas de frecuencia ──
  const movCounts = useMemo(() => {
    if (!periodo) return null;
    // Los reportes del período cuentan la economía en PESOS: Ingreso/Gasto FX sólo mueven la
    // reserva (no pasan por el disponible), así que no son movimientos de este período.
    // Compra/Venta de divisa sí entran: mueven pesos, igual que los trata esGasto().
    const movs = periodo.movimientos.filter((m) => afectaDisponible(m.tipo));
    const tipoColor = TIPO_COLOR;
    const vTipo = (m: typeof movs[0]) =>
      m.tipo === "Move" ? (m.direccionMove === "aAhorro" ? "MoveAhorro" : "MoveDisponible") : m.tipo;
    const vCat = (m: typeof movs[0]) =>
      m.categoria === "Move" ? (m.direccionMove === "aAhorro" ? "Move ahorros" : "Move disponible") : m.categoria;
    const domColor = (tipoMap: Map<string, number>) => {
      const dom = [...tipoMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a, ["", 0] as [string, number])[0];
      return tipoColor[dom] ?? "var(--accent)";
    };
    const porFechaMap = new Map<string, number>();
    for (const m of movs) porFechaMap.set(m.fecha, (porFechaMap.get(m.fecha) ?? 0) + 1);
    const [diaMasActivo, diaMasActivoN] = porFechaMap.size > 0
      ? [...porFechaMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a)
      : ["—", 0];
    const porTipoMap = new Map<string, number>();
    for (const m of movs) { const k = vTipo(m); porTipoMap.set(k, (porTipoMap.get(k) ?? 0) + 1); }
    // Per-group type tracking
    const catTipo = new Map<string, Map<string, number>>();
    const catMonto = new Map<string, number>();
    const medioTipo = new Map<string, Map<string, number>>();
    const medioMonto = new Map<string, number>();
    const medioTipoMonto = new Map<string, Map<string, number>>();
    for (const m of movs) {
      const cat = vCat(m);
      if (cat && cat !== "RESTO") {
        if (!catTipo.has(cat)) catTipo.set(cat, new Map());
        const t = catTipo.get(cat)!; const vt = vTipo(m); t.set(vt, (t.get(vt) ?? 0) + 1);
        catMonto.set(cat, (catMonto.get(cat) ?? 0) + m.monto);
      }
      // Caso border: medioPago es un guión placeholder (- – —) → data basura que se
      // atribuye a Mercado Pago. Vacío/sin medio (ej. Ingreso) queda fuera del gráfico.
      const mpRaw = m.medioPago?.trim();
      const esGuion = !!mpRaw && /^[-–—]+$/.test(mpRaw);
      const mp = esGuion ? "Mercado Pago" : (mpRaw || null);
      if (mp) {
        if (!medioTipo.has(mp)) medioTipo.set(mp, new Map());
        const t = medioTipo.get(mp)!; const vt = vTipo(m); t.set(vt, (t.get(vt) ?? 0) + 1);
        medioMonto.set(mp, (medioMonto.get(mp) ?? 0) + m.monto);
        if (!medioTipoMonto.has(mp)) medioTipoMonto.set(mp, new Map());
        const tmAmt = medioTipoMonto.get(mp)!; tmAmt.set(vt, (tmAmt.get(vt) ?? 0) + m.monto);
      }
    }
    const porCat = [...catTipo.entries()].map(([cat, t]) => ({ cat, count: [...t.values()].reduce((a,b)=>a+b,0), total: catMonto.get(cat) ?? 0, color: domColor(t) })).sort((a,b)=>b.count-a.count);
    const porMedio = [...medioTipo.entries()].map(([medio, tMap]) => ({ medio, count: [...tMap.values()].reduce((a,b)=>a+b,0), total: medioMonto.get(medio) ?? 0, color: domColor(tMap), tipos: [...tMap.entries()].map(([tipo, n]) => ({ tipo, n, monto: medioTipoMonto.get(medio)?.get(tipo) ?? 0 })).sort((a,b)=>b.n-a.n) })).sort((a,b)=>b.count-a.count);
    const porDow = [0,0,0,0,0,0,0];
    for (const m of movs) {
      if (m.fecha) porDow[new Date(m.fecha.includes("-") ? m.fecha + "T12:00:00" : m.fecha).getDay()]++;
    }
    return {
      total: movs.length,
      diasActivos: porFechaMap.size,
      diaMasActivo, diaMasActivoN,
      porTipo: [...porTipoMap.entries()].sort((a,b)=>b[1]-a[1]),
      porCat, porMedio, porDow,
    };
  }, [periodo]);

  return (
    <div className={`page ${isDesktop ? "page-fluid" : "page-wide"}`}>
      {loading ? (
        <LoadingSpinner />
      ) : periodos.length === 0 ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.noMovementsReport}</div>
      ) : (
        <div className="fade-up">
          <PageHeader
            title={t.pageTitleReports}
            style={{ marginBottom: 18 }}
            left={
              // El recap del período recién cerrado tiene prioridad; si no hay, el Wrapped
              // anual en su ventana de fin de año. Mismo lugar y MISMO tamaño (solo ícono, como
              // el wrapped): un botón con texto largo desbalanceaba el header.
              recap ? (
                <button onClick={abrirRecap} aria-label={t.recapTitle} title={t.recapTitle} style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 6, margin: -6 }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>
                </button>
              ) : hayWrapped ? (
                <button onClick={() => setWrappedOpen(true)} aria-label={t.yearWrapped} title={t.yearWrapped} style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "var(--green)", cursor: "pointer", padding: 6, margin: -6 }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </button>
              ) : undefined
            }
            right={
              // Acceso a Análisis (reportes avanzados). Ícono de "ajustes/sliders" para
              // distinguirlo de la lupa de Movimientos. Es una función TÁCTIL (swipe entre
              // modos, pills, tap para desglosar): en escritorio no se ofrece — el comparador
              // de períodos de esta misma pantalla cubre esa necesidad.
              isDesktop ? undefined : (
              <Link href="/analisis" aria-label={t.analyzeTitle} style={{ color: "var(--muted)", display: "flex", padding: 6, margin: -6 }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              </Link>
              )
            }
          />
          {showHint && <SectionHint title={t.hintRepTitle} body={t.hintRepBody} onDismiss={dismissHint} />}
          {/* Indicador deslizante: un fondo que se mueve bajo la pill activa con transición,
              en vez de encender/apagar el fondo de golpe (feeling native). */}
          <div className="subtabs" style={{ position: "relative" }}>
            <div aria-hidden style={{
              position: "absolute", top: 4, bottom: 4, left: 4,
              width: `calc((100% - 8px) / ${SUBS.length})`,
              // Sigue el dedo: base en el tab activo, desplazado por el progreso del swipe
              // (dragP<0 → hacia el siguiente). Sin transición mientras se arrastra.
              transform: `translateX(${(SUBS.findIndex((s) => s.id === sub) - dragP) * 100}%)`,
              transition: dragP !== 0 ? "none" : "transform .24s cubic-bezier(.2,.8,.2,1)",
              borderRadius: 999, background: APP_GRAD_DIM, border: "1px solid transparent",
            }} />
            {SUBS.map((s) => {
              const isActive = sub === s.id;
              return (
                <button key={s.id} onClick={() => setSub(s.id)} className="subtab"
                  style={{ position: "relative", zIndex: 1, background: "transparent" }}>
                  {isActive ? <span style={gradText}>{s.label}</span> : s.label}
                </button>
              );
            })}
          </div>
          {/* Selector de período — tap simple selecciona uno; toggle "Comparar" suma/quita.
              No aplica a Períodos (es una vista histórica de todos). */}
          {sub !== "periodos" && (() => {
            const activePill = pillOn;
            const inactivePill = pillOff;
            const años = Array.from(new Set(periodos.map((p) => periodoAnio(p.periodoId))));
            const añosActivos = new Set(activos.map((id) => periodoAnio(id)));
            // En comparar multi-año mostramos todos los activos; si no, los del año en vista.
            const añoVista = periodoAnio(activos[0] ?? periodos[0]?.periodoId ?? "");
            const pilisAMostrar = añosActivos.size > 1
              ? periodos.filter((p) => añosActivos.has(periodoAnio(p.periodoId)))
              : periodos.filter((p) => periodoAnio(p.periodoId) === añoVista);

            const togglePill = (id: string) => {
              if (!compareMode) { setPeriodosSelIds([id]); return; }
              setPeriodosSelIds((prev) => {
                const current = prev.length > 0 ? prev : [periodos[0]?.periodoId].filter(Boolean) as string[];
                if (current.includes(id)) {
                  const next = current.filter((x) => x !== id);
                  return next.length > 0 ? next : current; // nunca dejar 0
                }
                return [...current, id];
              });
            };
            const selectYear = (año: string) => {
              if (compareMode) {
                const ids = periodos.filter((p) => periodoAnio(p.periodoId) === año).map((p) => p.periodoId);
                setPeriodosSelIds((prev) => {
                  const current = prev.length > 0 ? prev : [periodos[0]?.periodoId].filter(Boolean) as string[];
                  const todos = ids.every((id) => current.includes(id));
                  const next = todos ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids]));
                  return next.length > 0 ? next : current;
                });
              } else {
                const primero = periodos.find((p) => periodoAnio(p.periodoId) === año);
                if (primero) setPeriodosSelIds([primero.periodoId]);
              }
            };

            return (
              <div style={{ marginBottom: 16 }}>
                {/* Fila de años + toggle Comparar */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "3px 3px 4px", scrollbarWidth: "none", touchAction: "pan-x", flex: 1 }}>
                    {años.map((año) => {
                      const isAñoActivo = añosActivos.has(año);
                      return (
                        <button key={año} onClick={() => selectYear(año)}
                          style={{
                            flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.15s",
                            ...(isAñoActivo ? activePill : inactivePill),
                          }}
                        >{isAñoActivo ? <span style={gradText}>{año}</span> : año}</button>
                      );
                    })}
                  </div>
                  {periodos.length > 1 && (
                    <button onClick={() => setCompareMode((v) => { const nv = !v; if (!nv) setPeriodosSelIds((p) => p.slice(0, 1)); return nv; })}
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999,
                        fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                        ...(compareMode ? activePill : inactivePill),
                      }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 10h14M7 10l-4 4 4 4"/><path d="M17 14H3M17 14l4-4-4-4" transform="translate(0 -4)"/>
                      </svg>
                    </button>
                  )}
                </div>
                {/* Pills de períodos */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "3px 3px 4px", scrollbarWidth: "none", alignItems: "center", touchAction: "pan-x" }}>
                  {pilisAMostrar.map((p) => {
                    const isSelected = activos.includes(p.periodoId);
                    return (
                      <button key={p.periodoId} onClick={() => togglePill(p.periodoId)}
                        style={{
                          flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                          transition: "all 0.15s",
                          ...(isSelected ? activePill : inactivePill),
                        }}
                      >{isSelected ? <span style={gradText}>{shortPer(p.periodoId)}</span> : shortPer(p.periodoId)}</button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Swipe horizontal entre subtabs. Las 4 pantallas van montadas en un track (en el
              orden de SUBS) → navegar solo desliza, el contenido ya está precargado y fluido.
              El guard anti-carrusel (para no romper las tiras de pills) vive en SwipeTabs. */}
          {/* Escritorio con 2+ períodos elegidos: comparación lado a lado. En móvil los
              períodos seleccionados se SUMAN en uno virtual (no hay ancho para columnas);
              acá cada uno es su columna y se lee la evolución de izquierda a derecha. */}
          {isDesktop && periodosActivos.length >= 2 && (
            <div style={{ marginBottom: 18 }}>
              <h2 className="inv-section-title">{t.compareTitle}</h2>
              <PeriodCompare periodos={periodosActivos} />
            </div>
          )}

          <SwipeTabs
            index={SUBS.findIndex((s) => s.id === sub)}
            count={SUBS.length}
            onIndexChange={(next) => setSub(SUBS[next].id)}
            onProgress={setDragP}
          >
            {/* 0 · Gastos */}
            {periodo && kpis ? (
              <GastosTab
                periodo={periodo} periodos={periodos} activos={activos} anterior={anterior}
                esPeriodoVigente={esPeriodoVigente} ritmo={ritmo} tendenciaGasto={tendenciaGasto} avgHistorico={avgHistorico}
                promPorMov={promPorMov} comp={comp} anomalias={anomalias} descs={descs} descsCompra={descsCompra}
                catsConPresu={catsConPresu} catsEditables={catsEditables}
                esCatCompra={esCatCompra} presupuesto={presupuesto} presupuestoEfectivo={presupuestoEfectivo}
                showBudget={showBudget} config={config} setShowBudget={setShowBudget} setEditingBudget={setEditingBudget}
                setModalBudget={setModalBudget} setCatModal={setCatModal} setCatAnteriorModal={setCatAnteriorModal}
                setModalTop={setModalTop} setKpiInfo={setKpiInfo}
              />
            ) : <div />}
            {/* 1 · Ingresos */}
            {periodo ? (
              <IngresosTab
                periodo={periodo} anterior={anterior} totalIngresos={totalIngresos} deltaIngresos={deltaIngresos}
                evolSueldoActivo={evolSueldoActivo} suelHistorial={suelHistorial}
                totalAhorradoDirecto={totalAhorradoDirecto} ahorrosAcumPeriodo={ahorrosAcumPeriodo}
                deltaAhorros={deltaAhorros} deltaAhorrosPct={deltaAhorrosPct} ingXDesc={ingXDesc}
                movIngresos={movIngresos} movIngresosAhorros={movIngresosAhorros} movResto={movResto}
                setKpiInfo={setKpiInfo} setModalSueldo={setModalSueldo} setModalAhorros={setModalAhorros}
              />
            ) : <div />}
            {/* 2 · Movimientos */}
            {periodo && movCounts ? (
              <MovimientosTab
                periodo={periodo} periodos={periodos} movCounts={movCounts} kpis={kpis}
                finPeriodo={finPeriodo} tendenciaMovs={tendenciaMovs} avgHistoricoMovs={avgHistoricoMovs}
                oculto={oculto} selectedMovTipo={selectedMovTipo} setSelectedMovTipo={setSelectedMovTipo}
                setKpiInfo={setKpiInfo} setModalTop={setModalTop} setMedioModal={setMedioModal}
              />
            ) : <div />}
            {/* 3 · Períodos */}
            {periodo ? (
              <PeriodosTab
                periodos={periodos} serie={serie} serieDesc={serieDesc} activos={activos} maxTotal={maxTotal}
                evolucionIngresos={evolucionIngresos} mejorPeriodo={mejorPeriodo} peorPeriodo={peorPeriodo}
                inflacionPersonal={inflacionPersonal} medianaGastoPeriodo={medianaGastoPeriodo} proyeccionGasto={proyeccionGasto}
                medianaAhorroPeriodo={medianaAhorroPeriodo} proyeccionAhorro={proyeccionAhorro} sueldoVsInflacion={sueldoVsInflacion}
                monedaPrincipal={monedaPrincipal} periodMetric={periodMetric} setPeriodMetric={setPeriodMetric}
                sueldoRealMode={sueldoRealMode} setSueldoRealMode={setSueldoRealMode} metricPickerOpen={metricPickerOpen}
                setMetricPickerOpen={setMetricPickerOpen} ipcVar={ipcVar} dolarAt={dolarAt} deflatar={deflatar}
                setNavPeriodo={setNavPeriodo} setKpiInfo={setKpiInfo}
              />
            ) : <div />}
          </SwipeTabs>
        </div>
      )}

      {/* Card: ir al período seleccionado en el gráfico */}
      <CenterCard open={!!navPeriodo} onClose={() => setNavPeriodo(null)} title={t.goToPeriodTitle}>
        {navPeriodo && (
          <>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
              {(navPeriodo.target === "ingresos" ? t.goToPeriodIncome : t.goToPeriodSpent)(shortPer(navPeriodo.periodoId))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setNavPeriodo(null)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
              <button onClick={() => { setPeriodosSelIds([navPeriodo.periodoId]); setSub(navPeriodo.target); setNavPeriodo(null); }}
                className="btn" style={{ flex: 1, padding: "13px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff", border: "none", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)" }}>{t.goToPeriodConfirm}</button>
            </div>
          </>
        )}
      </CenterCard>

      {/* Modal: Historial de aumentos de sueldo */}
      <CenterCard open={modalSueldo} onClose={() => setModalSueldo(false)} title={t.salaryHistory} maxWidth={400}>
        {suelHistorial.map((ev, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < suelHistorial.length - 1 ? "1px solid var(--faint)" : "none" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{ev.cuando}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {money(ev.de)} → {money(ev.a)}
              </div>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>+{ev.pct}%</span>
          </div>
        ))}
      </CenterCard>

      {/* Modal: Todo lo directo a ahorros */}
      <CenterCard open={modalAhorros} onClose={() => setModalAhorros(false)} title={t.directToSavings} maxWidth={400}>
        {movIngresosAhorros.map((m) => (
          <div key={m.id} className="row" style={{ padding: "10px 0", borderBottom: "1px solid var(--faint)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.origenAhorro || m.categoria}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{sinAño(m.fecha)}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>+{money(m.monto)}</span>
          </div>
        ))}
      </CenterCard>

      {/* Modal: Todos los top gastos/descripciones */}
      <BottomSheet open={!!modalTop} onClose={() => setModalTop(null)}
        title={modalTop === "gastos" ? t.top20Expenses : modalTop === "movcat" ? t.allCategories : t.allDescriptions}>
            {modalTop === "descs" && descsModal.map((d, i) => (
              <div key={d.nombre} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", width: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{i + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{d.nombre || "—"}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{money(d.monto)}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{d.pct}%</div>
                </div>
              </div>
            ))}
            {modalTop === "movcat" && movCounts && movCounts.porCat.map(({ cat, count, total, color }, i) => (
              <div key={cat} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", width: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{i + 1}</span>
                  <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{cat || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{count}×</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "••" : abbr(total)}</div>
                </div>
              </div>
            ))}
      </BottomSheet>

      {/* El detalle por día salía del gráfico "Por día", eliminado en v2.103.0 junto con este
          modal (era su único acceso). El detalle diario vive ahora en Movimientos. */}

      {kpiInfo && <KpiInfoModal title={kpiInfo.title} value={kpiInfo.value} explain={kpiInfo.explain} color={kpiInfo.color} onClose={() => setKpiInfo(null)} />}

      {/* Modal: gastos de una categoría */}
      <CenterCard open={!!catModal} onClose={() => setCatModal(null)} title={catModal ?? ""} maxWidth={420}>
        {(() => {
          if (!catModal || !periodo) return null;
          const movsCat = periodo.movimientos
            .filter((m) => (m.tipo === "Gasto" || m.tipo === "CompraUSD") && m.categoria === catModal);
          // Agrupado por descripción: en categorías repetitivas (peajes, café) el listado
          // movimiento por movimiento era un scroll interminable de la misma línea.
          const gruposCat = agruparGastosPorDescripcion(movsCat);
          const totalCat = movsCat.reduce((s, m) => s + m.monto, 0);
          const budgetCat = presupuestoEfectivo?.[catModal];
          return (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span>{money(totalCat)} · {t.expensesCount(movsCat.length)}</span>
                {budgetCat && !oculto && (() => {
                  const usedPct = Math.round((totalCat / budgetCat) * 100);
                  const bc = usedPct > 100 ? "var(--red)" : usedPct > 80 ? "var(--yellow)" : "var(--green)";
                  return <span style={{ color: bc, fontWeight: 600 }}>{t.budget}: {money(budgetCat)} · {usedPct}%</span>;
                })()}
              </div>
              {gruposCat.map((g) => (
                <div key={g.descripcion} className="row" style={{ padding: "11px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.descripcion}</span>
                    {/* El "×N" solo aparece si hubo más de uno: en los únicos sería ruido. */}
                    {g.veces > 1 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{g.veces}×</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", flexShrink: 0, marginLeft: 12 }}>{money(g.total)}</div>
                </div>
              ))}
              {movsCat.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 13 }}>{t.noMovements}</div>
              )}
            </>
          );
        })()}
      </CenterCard>

      {/* Modal: gastos de una categoría en el período ANTERIOR (fila de "vs período anterior").
          Mismo agrupado que el del período actual, para poder compararlos de un vistazo. */}
      <CenterCard open={!!catAnteriorModal} onClose={() => setCatAnteriorModal(null)} maxWidth={420}
        title={catAnteriorModal ? `${catAnteriorModal} · ${shortPer(anterior?.periodoId ?? "")}` : ""}>
        {(() => {
          if (!catAnteriorModal || !anterior) return null;
          const movsCat = anterior.movimientos
            .filter((m) => (m.tipo === "Gasto" || m.tipo === "CompraUSD") && m.categoria === catAnteriorModal);
          const grupos = agruparGastosPorDescripcion(movsCat);
          const total = movsCat.reduce((s, m) => s + m.monto, 0);
          return (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                {money(total)} · {t.expensesCount(movsCat.length)}
              </div>
              {grupos.map((g) => (
                <div key={g.descripcion} className="row" style={{ padding: "11px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.descripcion}</span>
                    {g.veces > 1 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{g.veces}×</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", flexShrink: 0, marginLeft: 12 }}>{money(g.total)}</div>
                </div>
              ))}
              {movsCat.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 13 }}>{t.noMovements}</div>
              )}
            </>
          );
        })()}
      </CenterCard>

      {/* Modal: detalle por medio de pago — totales por tipo de movimiento */}
      <CenterCard open={!!medioModal} onClose={() => setMedioModal(null)} title={medioModal ?? ""} maxWidth={380}>
        {(() => {
          if (!medioModal) return null;
          const data = movCounts?.porMedio.find((p) => p.medio === medioModal);
          if (!data) return null;
          return (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>{money(data.total)} · {data.count}×</div>
              {data.tipos.map(({ tipo, n, monto }) => (
                <div key={tipo} className="row" style={{ padding: "11px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: TIPO_COLOR[tipo] ?? "var(--accent)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>{t.tipoDisplay[tipo] ?? tipo}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{n}×</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", flexShrink: 0, marginLeft: 12 }}>{money(monto)}</div>
                </div>
              ))}
            </>
          );
        })()}
      </CenterCard>

      {/* Modal: editar presupuesto del período */}
      <BottomSheet open={modalBudget} onClose={() => setModalBudget(false)} title={t.budgetPeriod}>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: -10, marginBottom: 16 }}>
          {activos[0] ? shortPer(activos[0]) : ""}
          {config?.meta.presupuestoTemplate && Object.keys(config.meta.presupuestoTemplate).length > 0 && (
            <span style={{ marginLeft: 8, color: "var(--accent)" }}>· {t.budgetTemplate}</span>
          )}
        </div>

        {/* Indicador contra el ingreso: barra "distribuido vs sueldo" + remanente. El ingreso de
            referencia es sueldo + retiros de ahorro (totalIngresos), no solo el sueldo. */}
        {(() => {
          const ingreso = periodo ? periodo.sueldo + periodo.moveDisponible : 0;
          const montos: Record<string, number> = {};
          for (const [cat, val] of Object.entries(editingBudget)) { const n = parseFloat(val); if (!isNaN(n) && n > 0) montos[cat] = n; }
          const bal = balancePresupuesto(montos, ingreso);
          if (bal.sueldo === 0) return null; // sin sueldo en el período, no hay contra qué comparar
          const pct = Math.min(100, Math.round(bal.fraccion * 100));
          const colorBarra = bal.excede ? "var(--red)" : bal.fraccion > 0.9 ? "var(--yellow)" : "var(--green)";
          return (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{t.budgetDistributed} <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: 600 }}>{oculto ? "••" : money(bal.distribuido)}</span> {t.budgetOfIncome(oculto ? "••" : money(bal.sueldo))}</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: "var(--faint)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: colorBarra, transition: "width .3s ease, background .2s" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: bal.excede ? "var(--red)" : "var(--green)" }}>
                {bal.excede
                  ? `${t.budgetOver} ${oculto ? "••" : money(bal.excedente)}`
                  : `${t.budgetRemaining} ${oculto ? "••" : money(bal.restante)}`}
              </div>
            </div>
          );
        })()}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {catsEditables.map((cat) => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{cat}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--muted)", pointerEvents: "none" }}>$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editingBudget[cat] ?? ""}
                  onChange={(e) => setEditingBudget((prev) => ({ ...prev, [cat]: e.target.value }))}
                  placeholder="0"
                  className="input"
                  style={{ width: 130, paddingLeft: 22, textAlign: "right", fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>
          ))}
        </div>
        {(() => {
          const saved = presupuesto ?? {};
          const budgetIsDirty = catsEditables.some(cat => {
            const editVal = Math.round(parseFloat(editingBudget[cat] ?? "") || 0);
            const savedVal = Math.round(saved[cat] ?? 0);
            return editVal !== savedVal;
          });
          // Tope DURO: no se puede guardar un presupuesto que supere el ingreso del período.
          const ingreso = periodo ? periodo.sueldo + periodo.moveDisponible : 0;
          const montos: Record<string, number> = {};
          for (const [cat, val] of Object.entries(editingBudget)) { const n = parseFloat(val); if (!isNaN(n) && n > 0) montos[cat] = n; }
          const bal = balancePresupuesto(montos, ingreso);
          const disabled = budgetSaving || !budgetIsDirty || bal.excede;
          return (
            <>
              {bal.excede && (
                <div style={{ fontSize: 12, color: "var(--red)", textAlign: "center", marginBottom: 10, fontWeight: 600 }}>{t.budgetCapReached}</div>
              )}
              <button
                disabled={disabled}
                onClick={async () => {
                  if (!user?.uid || !activos[0] || bal.excede) return;
                  setBudgetSaving(true);
                  try {
                    await guardarPresupuesto(user.uid, activos[0], montos);
                    setPresupuesto(montos);
                    setModalBudget(false);
                  } finally {
                    setBudgetSaving(false);
                  }
                }}
                style={{ width: "100%", padding: "14px 0", borderRadius: "var(--radius-sm)", background: "var(--accent)", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, transition: "opacity 0.2s" }}>
                {budgetSaving ? "…" : t.save}
              </button>
            </>
          );
        })()}
      </BottomSheet>

      <YearWrapped open={wrappedOpen} onClose={() => setWrappedOpen(false)} />
      <RecapPeriodo open={recapOpen} onClose={() => setRecapOpen(false)} recap={recap} />
    </div>
  );
}
