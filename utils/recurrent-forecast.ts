// Proyección de recurrentes al calendario: en qué fecha se espera cada uno.
//
// No inventa un cálculo nuevo. Usa la MISMA referencia que el cron de notificaciones
// (lib/notifications): última carga que matchea la clave del recurrente, o createdAt si nunca
// se cargó. La fecha esperada es esa referencia + DUE_DAYS, el mismo umbral con el que el cron
// lo considera vencido — así el calendario y el push nunca dicen cosas distintas.

import { recurrentKey } from "./recurrent-key";
import { fechaISO_AR } from "./fecha-ar";
import { DUE_DAYS, PRE_DAYS, daysBetween } from "./recurrent-reminder";

// Lo mínimo que se necesita de un movimiento para matchear (evita atar esto al tipo completo).
type MovLike = {
  tipo: string;
  categoria: string;
  descripcion?: string;
  observaciones?: string;
  fecha?: string;
};

type RecLike = {
  id: string;
  tipo: string;
  categoria: string;
  descripcion: string;
  observaciones?: string;
  monto: number;
  activo: boolean;
  createdAt?: number;
};

export type RecurrenteProyectado = {
  id: string;
  descripcion: string;
  monto: number;
  tipo: string;
  /** Fecha esperada (YYYY-MM-DD) = referencia + DUE_DAYS. */
  fecha: string;
  /** Días desde la referencia hasta hoy. Negativo no ocurre (la ref es pasada). */
  dias: number;
  /**
   * En qué punto del ciclo está HOY, con los mismos umbrales del cron:
   *  · "lejos"   → todavía falta (< PRE_DAYS)
   *  · "cerca"   → se aproxima, el cron ya avisó o está por hacerlo (PRE_DAYS ≤ d < DUE_DAYS)
   *  · "vencido" → pasó la fecha esperada y no se cargó (≥ DUE_DAYS)
   */
  estado: "lejos" | "cerca" | "vencido";
};

/** YYYY-MM-DD sumándole días a otro YYYY-MM-DD, sin corrimientos de zona. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/**
 * Proyecta cada recurrente activo a su próxima fecha esperada.
 * @param recurrentes templates del usuario
 * @param movimientos movimientos para encontrar la última carga de cada uno
 * @param hoy         hoy en YYYY-MM-DD (hora AR, la calcula el llamador)
 */
export function proyectarRecurrentes(
  recurrentes: RecLike[],
  movimientos: MovLike[],
  hoy: string,
): RecurrenteProyectado[] {
  const activos = recurrentes.filter((r) => r.activo);
  if (activos.length === 0) return [];

  // Última carga por clave, en una sola pasada sobre los movimientos: con ~1.4K movimientos,
  // recorrerlos una vez por recurrente se notaba.
  const ultimaPorClave = new Map<string, string>();
  for (const m of movimientos) {
    if (!m.fecha) continue;
    const k = recurrentKey(m);
    const prev = ultimaPorClave.get(k);
    if (!prev || m.fecha > prev) ultimaPorClave.set(k, m.fecha);
  }

  const out: RecurrenteProyectado[] = [];
  for (const r of activos) {
    const ultima = ultimaPorClave.get(recurrentKey(r));
    // Misma referencia que el cron: última carga, o createdAt (en hora AR) si nunca se cargó.
    const ref = ultima || (r.createdAt ? fechaISO_AR(r.createdAt) : "");
    if (!ref) continue;

    const dias = daysBetween(ref, hoy);
    const estado = dias >= DUE_DAYS ? "vencido" : dias >= PRE_DAYS ? "cerca" : "lejos";
    out.push({
      id: r.id,
      descripcion: r.descripcion,
      monto: r.monto,
      tipo: r.tipo,
      fecha: sumarDias(ref, DUE_DAYS),
      dias,
      estado,
    });
  }
  return out;
}

/** Agrupa lo proyectado por fecha (YYYY-MM-DD), para pintar el calendario de un mes. */
export function proyectadosPorFecha(
  proyectados: RecurrenteProyectado[],
): Map<string, RecurrenteProyectado[]> {
  const m = new Map<string, RecurrenteProyectado[]>();
  for (const p of proyectados) {
    const arr = m.get(p.fecha);
    if (arr) arr.push(p); else m.set(p.fecha, [p]);
  }
  return m;
}
