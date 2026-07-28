// Presupuesto contra el sueldo: cuánto de tu ingreso ya distribuiste y cuánto queda.
//
// Objetivo del negocio: ajustar los gastos a lo que entra. La suma de lo presupuestado por
// categoría no debería superar el sueldo; el indicador muestra el remanente para decidir.

export type BalancePresupuesto = {
  /** Suma de todo lo presupuestado (los montos por categoría). */
  distribuido: number;
  /** Sueldo de referencia (real del período, o el último conocido para el template). */
  sueldo: number;
  /** sueldo − distribuido. Negativo = te pasaste. */
  restante: number;
  /** Fracción del sueldo ya distribuida (0..N). >1 = excede. Si no hay sueldo, 0. */
  fraccion: number;
  /** true si lo distribuido supera el sueldo. */
  excede: boolean;
  /** Cuánto se pasó del sueldo (0 si no excede). */
  excedente: number;
};

/**
 * Calcula el balance de un presupuesto contra un sueldo.
 * @param montos  presupuesto por categoría (los valores se suman; ignora ≤ 0 y no-números)
 * @param sueldo  ingreso de referencia (0 o negativo → sin referencia)
 */
export function balancePresupuesto(
  montos: Record<string, number>,
  sueldo: number,
): BalancePresupuesto {
  const distribuido = Object.values(montos).reduce((s, v) => (v > 0 ? s + v : s), 0);
  const ref = sueldo > 0 ? sueldo : 0;
  const restante = ref - distribuido;
  return {
    distribuido,
    sueldo: ref,
    restante,
    fraccion: ref > 0 ? distribuido / ref : 0,
    excede: ref > 0 && distribuido > ref,
    excedente: ref > 0 ? Math.max(0, distribuido - ref) : 0,
  };
}

/**
 * Máximo que una categoría puede tomar sin que el total pase el sueldo (para el tope DURO):
 * lo que queda libre + lo que esa categoría ya ocupaba. Sin sueldo de referencia → Infinity
 * (no se topea).
 * @param montos      presupuesto actual por categoría
 * @param categoria   la que se está editando
 * @param sueldo      ingreso de referencia
 */
export function topeCategoria(
  montos: Record<string, number>,
  categoria: string,
  sueldo: number,
): number {
  if (!(sueldo > 0)) return Infinity;
  const otras = Object.entries(montos).reduce((s, [k, v]) => (k !== categoria && v > 0 ? s + v : s), 0);
  return Math.max(0, sueldo - otras);
}
