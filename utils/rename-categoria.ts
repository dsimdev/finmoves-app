// Lógica pura del renombrado de categorías (testeable, sin Firestore).
//
// El nombre de una categoría NO es solo una etiqueta de config: cada movimiento guarda
// `m.categoria` como string, y también lo usan la clave del presupuesto y el doc id de los
// recurrentes. Renombrar sin migrar esos tres parte el historial (los movimientos viejos
// quedan en una categoría que ya no existe). Estas funciones deciden QUÉ hay que tocar; el
// servicio (services/firebase/rename-categoria) hace la escritura.

export type RenameCheck =
  | { ok: true }
  | { ok: false; motivo: "vacio" | "sin-cambio" | "duplicado" };

/**
 * Valida un rename antes de tocar nada.
 * @param actual   nombre actual
 * @param nuevo    nombre propuesto (se compara trim)
 * @param existentes todos los nombres de categoría (incluye el actual)
 */
export function validarRename(actual: string, nuevo: string, existentes: string[]): RenameCheck {
  const n = nuevo.trim();
  if (!n) return { ok: false, motivo: "vacio" };
  if (n === actual) return { ok: false, motivo: "sin-cambio" };
  // Choque con otra categoría (case-insensitive): fusionar dos categorías es otra operación,
  // no un rename, y silenciosamente uniría sus movimientos. Se bloquea.
  const otras = existentes.filter((e) => e !== actual).map((e) => e.toLowerCase());
  if (otras.includes(n.toLowerCase())) return { ok: false, motivo: "duplicado" };
  return { ok: true };
}

/** Ids de los movimientos que hay que migrar (los que tienen exactamente la categoría vieja). */
export function movimientosAMigrar<T extends { id: string; categoria: string }>(
  movimientos: T[],
  actual: string,
): string[] {
  return movimientos.filter((m) => m.categoria === actual).map((m) => m.id);
}

/** Devuelve la key del template de presupuesto renombrada, o null si esa categoría no tenía. */
export function renombrarTemplate(
  template: Record<string, number> | undefined,
  actual: string,
  nuevo: string,
): Record<string, number> | null {
  if (!template || !(actual in template)) return null;
  const next = { ...template };
  next[nuevo.trim()] = next[actual];
  delete next[actual];
  return next;
}

/** Devuelve el template sin la key de la categoría borrada, o null si no la tenía. */
export function quitarDeTemplate(
  template: Record<string, number> | undefined,
  categoria: string,
): Record<string, number> | null {
  if (!template || !(categoria in template)) return null;
  const next = { ...template };
  delete next[categoria];
  return next;
}
