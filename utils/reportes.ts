import { Movimiento } from "@/types";
import { PeriodoResumen } from "./periodo";

export interface Distribucion {
  nombre: string;
  monto: number;
  pct: number;
}

export function esGasto(m: Movimiento): boolean {
  return m.tipo === "Gasto" || m.tipo === "CompraUSD";
}

// Gasto "puro": excluye compras de divisa, que disparan promedios/desvíos/proyecciones.
// Se usa solo en cálculos estadísticos; los totales y el detalle por categoría usan esGasto.
export function esGastoPuro(m: Movimiento): boolean {
  return m.tipo === "Gasto";
}

// "D/M/YYYY" → Date
export function parsePeriodoId(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const DIA_MS = 86_400_000;

// Mediana del gasto por período y "variación" (coef. de variación = desvío/promedio).
// La mediana resiste outliers (un período atípico no la mueve). El CV resume qué
// tan regular es tu gasto entre períodos: bajo = parejo, alto = irregular.
export function estadisticasPeriodos(periodos: PeriodoResumen[]): { mediana: number; desvio: number; cv: number } | null {
  const vals = periodos.map((p) => p.gastadoPuro).filter((v) => v > 0);
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const media = vals.reduce((s, v) => s + v, 0) / vals.length;
  const varianza = vals.reduce((s, v) => s + (v - media) ** 2, 0) / vals.length;
  const desvio = Math.sqrt(varianza);
  const cv = media > 0 ? Math.round((desvio / media) * 100) : 0;
  return { mediana: Math.round(mediana), desvio: Math.round(desvio), cv };
}

// ── Distribuciones (sobre el gasto del período) ──────────────────────────────
function distribucion(
  movs: Movimiento[],
  keyFn: (m: Movimiento) => string,
  totalGastado: number
): Distribucion[] {
  const mapa = new Map<string, number>();
  for (const m of movs) {
    if (!esGasto(m)) continue;
    const k = keyFn(m) || "—";
    mapa.set(k, (mapa.get(k) ?? 0) + m.monto);
  }
  return Array.from(mapa.entries())
    .map(([nombre, monto]) => ({
      nombre,
      monto,
      pct: totalGastado > 0 ? Math.round((monto / totalGastado) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

export const gastosPorMedioPago = (movs: Movimiento[], totalGastado: number) =>
  distribucion(movs, (m) => m.medioPago, totalGastado);

export const gastosPorDescripcion = (movs: Movimiento[], totalGastado: number, topN = 12) =>
  distribucion(movs, (m) => m.descripcion, totalGastado).slice(0, topN);

// Gastos por fecha del evento (no de carga), más reciente primero
export function gastosPorFecha(movs: Movimiento[], totalGastado: number): Distribucion[] {
  const dist = distribucion(movs, (m) => m.fecha, totalGastado);
  return dist.sort((a, b) => {
    const parseDate = (s: string) => {
      if (s.includes("-")) return new Date(s).getTime();
      const [d, m, y] = s.split("/").map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    return parseDate(b.nombre) - parseDate(a.nombre);
  });
}

// ── KPIs del período ─────────────────────────────────────────────────────────
export interface KpisPeriodo {
  /** Día de mayor gasto, con cuántos movimientos (de cualquier tipo) tuvo ese día. */
  diaMayorGasto: { fecha: string; monto: number; movs: number } | null;
  diaMasMovimientos: { fecha: string; cant: number } | null;
  /** El gasto individual más caro del período. */
  gastoMasGrande: { monto: number; descripcion: string; fecha: string } | null;
  cantGastos: number;
  cantIngresos: number;
  promedioDiario: number;
  diasConGasto: number;
}

export function kpisPeriodo(p: PeriodoResumen): KpisPeriodo {
  const porFechaMonto = new Map<string, number>();
  const porFechaCant = new Map<string, number>();
  let cantGastos = 0;
  let cantIngresos = 0;
  let gastoPuro = 0; // suma de tipo Gasto, para el promedio diario sin divisa
  // Gasto individual más grande del período (solo gasto puro, con su descripción).
  let gastoMasGrande: { monto: number; descripcion: string; fecha: string } | null = null;

  for (const m of p.movimientos) {
    porFechaCant.set(m.fecha, (porFechaCant.get(m.fecha) ?? 0) + 1);
    if (esGasto(m)) {
      cantGastos++;
      // Día pico y promedio diario: solo gasto puro (sin compras de divisa).
      if (esGastoPuro(m)) {
        gastoPuro += m.monto;
        porFechaMonto.set(m.fecha, (porFechaMonto.get(m.fecha) ?? 0) + m.monto);
        if (!gastoMasGrande || m.monto > gastoMasGrande.monto) {
          gastoMasGrande = { monto: m.monto, descripcion: m.descripcion || m.categoria, fecha: m.fecha };
        }
      }
    } else if (m.tipo === "Ingreso") {
      cantIngresos++;
    }
  }

  const diaMayorGasto = [...porFechaMonto.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const diaMasMov = [...porFechaCant.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const diasConGasto = porFechaMonto.size;

  return {
    diaMayorGasto: diaMayorGasto ? { fecha: diaMayorGasto[0], monto: diaMayorGasto[1], movs: porFechaCant.get(diaMayorGasto[0]) ?? 0 } : null,
    diaMasMovimientos: diaMasMov ? { fecha: diaMasMov[0], cant: diaMasMov[1] } : null,
    gastoMasGrande,
    cantGastos,
    cantIngresos,
    promedioDiario: diasConGasto > 0 ? gastoPuro / diasConGasto : 0,
    diasConGasto,
  };
}

// ── Ritmo de gasto (burn rate) ───────────────────────────────────────────────
export interface RitmoGasto {
  diasTranscurridos: number;
  gastadoPorDia: number;
  proyeccionCierre: number; // proyección a 30 días de período
  enCurso: boolean;
}

// inicio = parsePeriodoId(periodoId); fin = inicio del período más nuevo (o null si es el actual)
export function ritmoGasto(p: PeriodoResumen, finPeriodo: Date | null, hoy = new Date()): RitmoGasto {
  const inicio = parsePeriodoId(p.periodoId);
  const enCurso = finPeriodo === null;
  const corte = enCurso ? hoy : finPeriodo;
  const dias = Math.max(1, Math.round((corte.getTime() - inicio.getTime()) / DIA_MS));
  const gastadoPorDia = p.gastadoPuro / dias;
  return {
    diasTranscurridos: dias,
    gastadoPorDia,
    proyeccionCierre: gastadoPorDia * 30,
    enCurso,
  };
}

// ── Comparativa de categorías vs período anterior ────────────────────────────
export interface DeltaCategoria {
  categoria: string;
  actual: number;
  anterior: number;
  deltaPct: number | null; // null si no había gasto antes
}

export function comparativaCategorias(
  actual: PeriodoResumen,
  anterior: PeriodoResumen | undefined
): DeltaCategoria[] {
  const sumar = (movs: Movimiento[]) => {
    const m = new Map<string, number>();
    for (const mv of movs) if (esGasto(mv)) m.set(mv.categoria, (m.get(mv.categoria) ?? 0) + mv.monto);
    return m;
  };
  const act = sumar(actual.movimientos);
  const ant = anterior ? sumar(anterior.movimientos) : new Map<string, number>();
  const cats = new Set([...act.keys(), ...ant.keys()]);

  return [...cats]
    .map((categoria) => {
      const a = act.get(categoria) ?? 0;
      const b = ant.get(categoria) ?? 0;
      const deltaPct = b > 0 ? ((a - b) / b) * 100 : null;
      return { categoria, actual: a, anterior: b, deltaPct };
    })
    .sort((x, y) => y.actual - x.actual);
}

// ── Anomalía de gasto: actual vs el PROMEDIO de N períodos anteriores ────────
// comparativaCategorias compara contra el período inmediato anterior (un solo dato, ruidoso:
// un mes atípico corre la comparación entera). Esto promedia una ventana más ancha — la misma
// pregunta que categoriasEnRiesgo (utils/budget-alert) responde para el presupuesto, pero
// contra el propio historial de la categoría en vez de un tope fijo.

export const UMBRAL_ANOMALIA_PCT = 50; // % sobre el promedio para marcar la categoría

export interface AnomaliaCategoria {
  categoria: string;
  actual: number;
  promedio: number;
  /** (actual - promedio) / promedio × 100. Siempre > 0 (solo se listan los que superan el umbral). */
  deltaPct: number;
}

/**
 * @param actual      período en curso
 * @param anteriores  períodos previos, del más nuevo al más viejo (se usan los primeros
 *                    `ventana`); típicamente periodos.slice(1) desde el más reciente
 * @param ventana     cuántos períodos anteriores promediar
 */
export function anomaliasCategorias(
  actual: PeriodoResumen,
  anteriores: PeriodoResumen[],
  ventana: number,
): AnomaliaCategoria[] {
  // esGastoPuro, NO esGasto: las compras de divisa son irregulares por naturaleza (se compra
  // cuando sobra o cuando conviene el precio), así que contra un promedio siempre dan desvío
  // y marcarían "anomalía" cada vez que comprás. Misma razón por la que esGastoPuro existe.
  const sumar = (movs: Movimiento[]) => {
    const m = new Map<string, number>();
    for (const mv of movs) if (esGastoPuro(mv)) m.set(mv.categoria, (m.get(mv.categoria) ?? 0) + mv.monto);
    return m;
  };
  const historial = anteriores.slice(0, ventana);
  if (historial.length < ventana) return []; // no hay suficiente historial para un promedio confiable

  const act = sumar(actual.movimientos);
  const sumasHist = historial.map((p) => sumar(p.movimientos));

  const out: AnomaliaCategoria[] = [];
  for (const [categoria, a] of act.entries()) {
    const promedio = sumasHist.reduce((s, m) => s + (m.get(categoria) ?? 0), 0) / historial.length;
    if (promedio <= 0) continue; // sin historial de esta categoría, no hay base para comparar
    const deltaPct = ((a - promedio) / promedio) * 100;
    if (deltaPct > UMBRAL_ANOMALIA_PCT) out.push({ categoria, actual: a, promedio, deltaPct });
  }
  return out.sort((x, y) => y.deltaPct - x.deltaPct);
}

// ── Tendencias: serie por período (más viejo → más nuevo) ────────────────────
export interface PuntoTendencia {
  periodoId: string;
  sueldo: number;
  gastado: number;
  gastadoPuro: number;
  disponible: number;
  total: number;
  /** Ahorro BRUTO del período: depósitos + ingresos directos a ahorro. NO descuenta los
   *  retiros hacia disponible — para proyectar usá `ahorroNeto`. */
  ahorros: number;
  /** Ahorro NETO del período: bruto − moves a disponible. Puede quedar por debajo de
   *  `deltaAcum` si el retiro supera lo acumulado (ver `deltaAcum`). */
  ahorroNeto: number;
  /** Lo que el acumulado se movió DE VERDAD en el período (`ahorrosAcum` − el anterior).
   *  Igual a `ahorroNeto` salvo cuando el clamp a 0 lo corta: ahí es menor en magnitud,
   *  porque no se puede retirar un ahorro que nunca se registró. Base de los promedios:
   *  usar el neto crudo daba ritmos que contradecían al acumulado mostrado al lado. */
  deltaAcum: number;
  ahorrosAcum: number;
}

export function serieTendencia(periodos: PeriodoResumen[], seedPeriodoId?: string): PuntoTendencia[] {
  const cron = [...periodos].reverse();
  // Si hay seed guardado, anclar desde ese período para que la ventana crezca hacia adelante.
  // Si no hay seed aún (primera vez), usar los últimos 2 como baseline provisional.
  let startIdx: number;
  if (seedPeriodoId) {
    const idx = cron.findIndex((p) => p.periodoId === seedPeriodoId);
    startIdx = idx >= 0 ? idx : Math.max(0, cron.length - 2);
  } else {
    startIdx = Math.max(0, cron.length - 2);
  }
  let acum = 0;
  return cron.map((p, i) => {
    const ahorrosDelPeriodo = p.ahorros + p.moveAhorros;
    const neto = ahorrosDelPeriodo - p.moveDisponible;
    // El acumulado no puede ser negativo (no existe "ahorro negativo"): si el retiro supera
    // lo acumulado, se clampea a 0. `deltaAcum` es lo que el acumulado REALMENTE se movió,
    // que en ese caso es menos que `neto` — la diferencia es plata que salió pero que nunca
    // estuvo registrada como ahorro. Los promedios usan este delta, no el neto crudo.
    const previo = acum;
    if (i >= startIdx) acum = Math.max(0, acum + neto);
    return {
      periodoId: p.periodoId,
      sueldo: p.sueldo,
      gastado: p.gastado,
      gastadoPuro: p.gastadoPuro,
      disponible: p.disponible,
      total: p.total,
      ahorros: ahorrosDelPeriodo,
      ahorroNeto: neto,
      deltaAcum: i >= startIdx ? acum - previo : 0,
      ahorrosAcum: acum,
    };
  });
}

// Inflación personal: variación REAL del gasto puro entre períodos consecutivos,
// promediada. `deflate` lleva el gasto nominal a términos reales (IPC) en ARS; para
// otras monedas se pasa la identidad. `periodos` viene en orden descendente (más
// nuevo primero); se excluye el primero (período en curso, incompleto). Única fuente
// para Inicio y Reportes — antes cada pantalla usaba su propia fórmula (promedio
// nominal vs. última variación deflactada) y podían dar signos opuestos.
// Variación del gasto del período EN CURSO vs. el anterior (el dato inmediato del Inicio,
// distinto del promedio histórico de inflacionPersonal que usa Reportes). `periodos` viene
// en orden descendente (el [0] es el que está corriendo). OJO: el período en curso está
// incompleto, así que al arrancar el período el número da muy negativo y sube al gastar.
// `deflate` lleva a términos reales (IPC) en ARS; identidad en otras monedas.
export function variacionGastoVsAnterior(
  periodos: PeriodoResumen[],
  deflate: (gasto: number, periodoId: string) => number = (g) => g,
): number | null {
  if (periodos.length < 2) return null;
  const gastoPuro = (p: PeriodoResumen) =>
    deflate(p.movimientos.filter((m) => m.tipo === "Gasto").reduce((s, m) => s + m.monto, 0), p.periodoId);
  const actual = gastoPuro(periodos[0]);
  const anterior = gastoPuro(periodos[1]);
  if (anterior <= 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

export function inflacionPersonal(
  periodos: PeriodoResumen[],
  deflate: (gasto: number, periodoId: string) => number = (g) => g,
): number | null {
  const chron = periodos
    .slice(1)
    .map((p) => ({ id: p.periodoId, gasto: deflate(p.movimientos.filter((m) => m.tipo === "Gasto").reduce((s, m) => s + m.monto, 0), p.periodoId) }))
    .filter((p) => p.gasto > 0)
    .sort((a, b) => parsePeriodoId(a.id).getTime() - parsePeriodoId(b.id).getTime());
  if (chron.length < 2) return null;
  let sum = 0, n = 0;
  for (let i = 1; i < chron.length; i++) {
    const prev = chron[i - 1].gasto;
    if (prev > 0) { sum += (chron[i].gasto - prev) / prev; n++; }
  }
  return n > 0 ? (sum / n) * 100 : null;
}

// ── Estadísticas avanzadas ────────────────────────────────────────────────────

export function diasSinGastos(
  movs: Movimiento[],
  startDate: Date,
  endDate: Date
): { sinGasto: number; total: number } {
  const daysWithGasto = new Set<string>();
  for (const m of movs) if (esGasto(m)) daysWithGasto.add(m.fecha);
  const total = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / DIA_MS));
  return { sinGasto: Math.max(0, total - daysWithGasto.size), total };
}

export function mejorPeriodo(periodos: PeriodoResumen[]): PeriodoResumen | null {
  if (periodos.length === 0) return null;
  return periodos.reduce((b, p) => p.pct < b.pct ? p : b);
}

export function peorPeriodo(periodos: PeriodoResumen[]): PeriodoResumen | null {
  if (periodos.length === 0) return null;
  return periodos.reduce((w, p) => p.pct > w.pct ? p : w);
}

export function historialSueldo(
  periodos: PeriodoResumen[]
): { cuando: string; de: number; a: number; pct: number }[] {
  if (periodos.length < 2) return [];
  const maxSueldo = Math.max(...periodos.map((p) => p.sueldo));
  const esVac = (s: number) => s < maxSueldo * 0.5;
  const nonVac = periodos.filter((p) => !esVac(p.sueldo));
  if (nonVac.length < 2) return [];
  // Niveles salariales distintos en orden cronológico (oldest first)
  const chron = [...nonVac].reverse();
  const levels: { sueldo: number; periodoId: string }[] = [];
  for (const p of chron) {
    if (levels.length === 0 || levels[levels.length - 1].sueldo !== p.sueldo) {
      levels.push({ sueldo: p.sueldo, periodoId: p.periodoId });
    }
  }
  if (levels.length < 2) return [];
  // Eventos de aumento (newest first), solo subidas
  const events: { cuando: string; de: number; a: number; pct: number }[] = [];
  for (let i = levels.length - 1; i >= 1; i--) {
    const de = levels[i - 1].sueldo;
    const a = levels[i].sueldo;
    if (a > de) events.push({ cuando: levels[i].periodoId, de, a, pct: Math.round(((a - de) / de) * 100) });
  }
  return events;
}

// ── Ritmo de ahorro: base ÚNICA de todas las proyecciones ────────────────────
// Reglas (unificadas en v2.90.0; antes cada pantalla usaba la suya y se contradecían):
//  1. Ventana: TODOS los períodos desde el seed (`ahorrosAcumSeedPeriodoId`) hasta el actual
//     inclusive. El seed marca desde cuándo la carga de movimientos es confiable, así que
//     promedia toda la historia útil en vez de descartar datos buenos. Se incluye el período
//     en curso porque el acumulado (`ahorrosAcum`, el número grande) también lo cuenta:
//     excluirlo daba "ritmo 0" a alguien que sí había ahorrado este período.
//  2. Ahorro NETO (`ahorroNeto`): descuenta lo que se movió de vuelta a disponible. Usar el
//     bruto daba ritmos mayores al propio acumulado.
//  3. Deflactado: `deflate` lleva cada período a moneda de hoy (IPC en ARS; identidad en
//     USD/EUR). Sin esto, promediar períodos viejos subestima con inflación alta.
// La serie que llega ya viene acumulada desde el seed (serieTendencia), pero incluye los
// puntos anteriores con acum 0: `desdeSeed` los recorta para que no diluyan el promedio.
export function desdeSeed(serie: PuntoTendencia[], seedPeriodoId?: string): PuntoTendencia[] {
  if (!seedPeriodoId) return serie;
  const idx = serie.findIndex((p) => p.periodoId === seedPeriodoId);
  return idx >= 0 ? serie.slice(idx) : serie;
}

export function ritmoAhorro(
  serie: PuntoTendencia[],
  deflate: (monto: number, periodoId: string) => number = (m) => m,
  seedPeriodoId?: string,
): number | null {
  // serie viene cronológica (más viejo → más nuevo); el último es el período en curso.
  const ventana = desdeSeed(serie, seedPeriodoId);
  if (ventana.length === 0) return null;
  // `deltaAcum` (no `ahorroNeto`): el ritmo tiene que explicar el acumulado que se muestra
  // al lado. Con un retiro mayor a lo acumulado, el neto crudo daba un ritmo negativo enorme
  // mientras el acumulado real apenas bajaba a 0. Fallback al neto para series ya serializadas.
  const suma = ventana.reduce((s, p) => s + deflate(p.deltaAcum ?? p.ahorroNeto ?? 0, p.periodoId), 0);
  return Number.isFinite(suma) ? suma / ventana.length : null;
}

export function proyectarAhorros(
  serie: PuntoTendencia[],
  nPeriodos: number,
  deflate: (monto: number, periodoId: string) => number = (m) => m,
  seedPeriodoId?: string,
): number {
  if (serie.length === 0) return 0;
  const ritmo = ritmoAhorro(serie, deflate, seedPeriodoId) ?? 0;
  return serie[serie.length - 1]!.ahorrosAcum + Math.max(0, ritmo) * nPeriodos;
}

export function periodosParaMetaARS(
  serie: PuntoTendencia[],
  metaARS: number,
  deflate: (monto: number, periodoId: string) => number = (m) => m,
  seedPeriodoId?: string,
): number | null {
  if (serie.length === 0) return null;
  const acumActual = serie[serie.length - 1]!.ahorrosAcum;
  if (acumActual >= metaARS) return 0;
  const ritmo = ritmoAhorro(serie, deflate, seedPeriodoId);
  if (ritmo === null || ritmo <= 0) return null;
  return Math.ceil((metaARS - acumActual) / ritmo);
}

// ── Ritmo necesario para llegar a una FECHA objetivo ─────────────────────
// La meta tiene una fecha opcional que hoy es puramente decorativa (se muestra, nunca se
// cruza contra el ritmo real). Es el inverso exacto de periodosParaMetaARS: en vez de
// "¿cuántos períodos faltan al ritmo actual?", "¿cuántos períodos HAY hasta la fecha, y qué
// ritmo hace falta para llegar en esa cantidad?".

/**
 * Períodos entre hoy y una fecha objetivo, dada la duración típica del período (ver
 * utils/duracion-disponible duracionMedianaPeriodos). Redondea hacia arriba: si faltan 35
 * días y el período dura 30, hay que llegar "en 2 períodos", no en 1.17.
 *
 * @returns 0 si la fecha ya pasó o es hoy (no hay margen); null si la fecha es inválida.
 */
export function periodosHastaFecha(fechaObjetivoISO: string, diasPorPeriodo: number, hoy = new Date()): number | null {
  const [y, m, d] = fechaObjetivoISO.split("-").map(Number);
  if (!y || !m || !d) return null;
  const objetivo = Date.UTC(y, m - 1, d);
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const diasFaltantes = Math.round((objetivo - hoyUTC) / 86_400_000);
  if (diasFaltantes <= 0) return 0;
  return Math.max(1, Math.ceil(diasFaltantes / diasPorPeriodo));
}

/**
 * Ritmo (por período) necesario para cubrir `faltante` en `periodos` períodos. null si no hay
 * períodos por delante (0 o negativo) — no hay margen para calcular un ritmo.
 */
export function ritmoNecesarioParaFecha(faltante: number, periodos: number | null): number | null {
  if (periodos === null || periodos <= 0) return null;
  if (faltante <= 0) return 0; // ya alcanzada, no hace falta ritmo
  return faltante / periodos;
}

// ── Estadísticas de metas de ahorro ──────────────────────────────────────

export function progresoMetaUSD(ahorrosAcumARS: number, metaUSD: number, cotizacionBlue: number): number {
  const metaEnARS = metaUSD * cotizacionBlue;
  return Math.round((ahorrosAcumARS / metaEnARS) * 100);
}

export function periodosParaMetaUSD(
  serie: PuntoTendencia[],
  metaUSD: number,
  cotizacionBlue: number,
  deflate: (monto: number, periodoId: string) => number = (m) => m,
  seedPeriodoId?: string,
): number | null {
  const metaEnARS = metaUSD * cotizacionBlue;
  return periodosParaMetaARS(serie, metaEnARS, deflate, seedPeriodoId);
}

// Progreso de la META PROPIA (en la moneda principal del usuario). El "acumulado" son los
// ahorros ya calculados en esa moneda (serie.ahorrosAcum), no un saldo cargado a mano. Como
// meta y ahorros están en la MISMA moneda, no hay conversión. Devuelve todo lo que la card
// necesita: acumulado, %, faltante, y períodos estimados para llegar (por el ritmo de ahorro).
export function progresoMetaPropia(
  serie: PuntoTendencia[],
  metaMonto: number,
  deflate: (monto: number, periodoId: string) => number = (m) => m,
  seedPeriodoId?: string,
): {
  acumulado: number; pct: number; faltante: number; periodos: number | null;
} | null {
  if (metaMonto <= 0 || serie.length === 0) return null;
  const acumulado = Math.max(0, serie[serie.length - 1]!.ahorrosAcum);
  const pct = Math.min(100, Math.round((acumulado / metaMonto) * 100));
  const faltante = Math.max(0, metaMonto - acumulado);
  return { acumulado, pct, faltante, periodos: periodosParaMetaARS(serie, metaMonto, deflate, seedPeriodoId) };
}
