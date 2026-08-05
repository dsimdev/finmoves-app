// Alerta de desvío de presupuesto: proyecta, con el ritmo del período, si una categoría
// va camino a pasarse de su presupuesto — y avisa ANTES de pasarse, cuando todavía se puede
// corregir. Pura y testeable (el check del cron en lib/notifications.ts la usa).
//
// Un período dura ~30 días (la app proyecta el cierre con `gastadoPorDia * 30`, ver
// utils/reportes.ts ritmoGasto). La proyección por categoría hace lo mismo: lo gastado hasta
// hoy, estirado al ritmo diario por los 30 días del período.

const DIAS_PERIODO = 30;

// No proyectar al principio del período: con pocos días el ritmo es ruido y avisaría de más.
// A partir de ~30% del período (9 días) el ritmo ya es representativo.
export const MIN_DIAS_PARA_PROYECTAR = 9;

// Umbral de proyección: avisar cuando el cierre proyectado supera el presupuesto. 1.0 = justo
// el presupuesto; un pelín arriba (1.05) evita avisar por un desvío trivial que se corrige solo.
export const UMBRAL_PROYECCION = 1.05;

export interface CategoriaEnRiesgo {
  categoria: string;
  gastado: number;
  presupuesto: number;
  /** Cierre proyectado al ritmo actual. */
  proyeccion: number;
  /** proyeccion / presupuesto, redondeado a % entero. */
  pctProyectado: number;
  /**
   * true si el gasto YA superó el presupuesto (hecho consumado), false si todavía está por
   * debajo y es el ritmo el que proyecta pasarse (se puede corregir). Son dos situaciones
   * distintas y no deben avisarse con el mismo mensaje.
   */
  excedida: boolean;
  /** gastado / presupuesto, redondeado a % entero. Lo REAL, no lo proyectado. */
  pctGastado: number;
}

/**
 * Categorías que, al ritmo del período, van a cerrar por encima de su presupuesto.
 *
 * @param gastadoPorCategoria  lo gastado hasta hoy por categoría (solo las que tienen gasto)
 * @param presupuesto          presupuesto efectivo por categoría (override o template)
 * @param diasTranscurridos    días desde que abrió el período hasta hoy
 * @param yaAvisadas           categorías ya notificadas este período (dedup, no re-avisar)
 */
export function categoriasEnRiesgo(
  gastadoPorCategoria: Record<string, number>,
  presupuesto: Record<string, number>,
  diasTranscurridos: number,
  yaAvisadas: string[] = []
): CategoriaEnRiesgo[] {
  // Guarda de "período ya avanzado": antes de MIN_DIAS no hay datos suficientes para proyectar.
  if (diasTranscurridos < MIN_DIAS_PARA_PROYECTAR) return [];

  const avisadas = new Set(yaAvisadas);
  const enRiesgo: CategoriaEnRiesgo[] = [];

  for (const [categoria, presu] of Object.entries(presupuesto)) {
    if (!(presu > 0)) continue;               // categoría sin presupuesto real
    if (avisadas.has(categoria)) continue;    // ya avisé por esta en este período
    const gastado = gastadoPorCategoria[categoria] ?? 0;
    if (gastado <= 0) continue;               // sin gasto real → nada que proyectar

    const proyeccion = (gastado / diasTranscurridos) * DIAS_PERIODO;
    const excedida = gastado > presu;
    // Una categoría entra si YA se pasó (hecho consumado) o si el ritmo proyecta que se va a
    // pasar. Sin lo primero, cruzar el presupuesto pasaba desapercibido cuando el ritmo del
    // período ya se había amesetado.
    if (!excedida && proyeccion <= presu * UMBRAL_PROYECCION) continue;

    enRiesgo.push({
      categoria,
      gastado,
      presupuesto: presu,
      proyeccion,
      pctProyectado: Math.round((proyeccion / presu) * 100),
      excedida,
      pctGastado: Math.round((gastado / presu) * 100),
    });
  }

  // Peor primero (mayor % proyectado): si hay varias, el cuerpo del push muestra las top.
  return enRiesgo.sort((a, b) => b.pctProyectado - a.pctProyectado);
}

/** Separa las que ya se pasaron de las que todavía están a tiempo. */
export const partirPorEstado = (cats: CategoriaEnRiesgo[]) => ({
  excedidas: cats.filter((c) => c.excedida).sort((a, b) => b.pctGastado - a.pctGastado),
  enRiesgo: cats.filter((c) => !c.excedida),
});

/**
 * % REAL (no proyectado) del presupuesto de una categoría, sumando un monto en curso — para
 * el chip del alta, donde importa "cuánto llevás gastado ya", no la proyección a 30 días del
 * cron (que puede marcar riesgo con poco gastado si el período recién empezó, confuso en el
 * momento de cargar). null si la categoría no tiene presupuesto puesto (nada que mostrar).
 */
export function pctPresupuestoCategoria(
  categoria: string,
  gastadoPorCategoria: Record<string, number>,
  presupuesto: Record<string, number>,
  montoEnCurso: number
): number | null {
  const presu = presupuesto[categoria];
  if (!(presu > 0)) return null;
  const gastado = (gastadoPorCategoria[categoria] ?? 0) + Math.max(0, montoEnCurso);
  return Math.round((gastado / presu) * 100);
}
