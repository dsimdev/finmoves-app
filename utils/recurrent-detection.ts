import { Movimiento } from "@/types";
import { recurrentKey } from "./recurrent-key";

// Sugerencia pasiva de "esto parece recurrente": la misma combinación tipo+categoría+
// descripción+observación (recurrentKey, MISMA clave que el doc id/relojito/cron — ver
// recurrent-key.ts) apareció en 3+ PERÍODOS distintos, sin estar ya marcada como recurrente.
// No se exige monto igual — un alquiler con ajuste o un gimnasio que sube de precio siguen
// siendo recurrentes.
//
// Cadencia de UNA carga por período: un recurrente es un pago fijo que entra una vez por
// período (alquiler, Netflix). Un gasto diario que se repite con la misma descripción
// ("Café", "Almuerzo") también cruza 3+ períodos, pero se carga varias veces en cada uno —
// sugerirlo como recurrente es ruido. Si CUALQUIER período tiene más de una carga, no se
// sugiere.

export const PERIODOS_PARA_SUGERIR = 3;

/**
 * @param movimientos       historial completo del usuario (ya en memoria, sin query nueva)
 * @param actual             tipo/categoría/descripción/observaciones que se está cargando
 * @param recurrenteKeysActivos  claves (recurrentKey) de los recurrentes YA activos — si la
 *                               combinación actual ya es uno de estos, nunca sugiere de nuevo
 */
export function sugerirRecurrente(
  movimientos: Movimiento[],
  actual: { tipo: string; categoria: string; descripcion?: string; observaciones?: string },
  recurrenteKeysActivos: Set<string>
): boolean {
  if (!actual.descripcion?.trim()) return false;
  const key = recurrentKey(actual);
  if (recurrenteKeysActivos.has(key)) return false; // ya es recurrente, no hay nada que sugerir

  const cargasPorPeriodo = new Map<string, number>();
  for (const m of movimientos) {
    if (recurrentKey(m) !== key) continue;
    const n = (cargasPorPeriodo.get(m.periodoId) ?? 0) + 1;
    if (n > 1) return false; // se carga varias veces en un mismo período: es gasto frecuente, no un pago fijo
    cargasPorPeriodo.set(m.periodoId, n);
  }
  return cargasPorPeriodo.size >= PERIODOS_PARA_SUGERIR;
}
