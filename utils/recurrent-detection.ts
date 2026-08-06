import { Movimiento } from "@/types";
import { recurrentKey } from "./recurrent-key";

// Sugerencia pasiva de "esto parece recurrente": la misma combinación tipo+categoría+
// descripción+observación (recurrentKey, MISMA clave que el doc id/relojito/cron — ver
// recurrent-key.ts) apareció en 3+ PERÍODOS distintos, sin estar ya marcada como recurrente.
// Se cuenta por período, no por cantidad de cargas: 3 compras en el mismo período no son un
// patrón recurrente, son gasto repetido casual dentro de un mes. No se exige monto igual — un
// alquiler con ajuste o un gimnasio que sube de precio siguen siendo recurrentes.

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

  const periodosConMatch = new Set<string>();
  for (const m of movimientos) {
    if (recurrentKey(m) !== key) continue;
    periodosConMatch.add(m.periodoId);
  }
  return periodosConMatch.size >= PERIODOS_PARA_SUGERIR;
}
