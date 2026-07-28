
// Derivaciones del tipo de movimiento y del cálculo FX. Vivían inline en MovementModal como
// ~15 booleanos sueltos; acá son puras y testeables. Es la zona con más bugs históricos del
// modal (cotización de VentaEUR, ganancia FX con base, NaN por campos vacíos).

const TIPOS_FX = [
  "CompraUSD", "GastoUSD", "VentaUSD", "IngresoUSD",
  "CompraEUR", "GastoEUR", "VentaEUR", "IngresoEUR",
] as const;

export function esTipoFX(tipo: string): boolean {
  return (TIPOS_FX as readonly string[]).includes(tipo);
}

/** La divisa del tipo. USD por defecto (los tipos no-FX no la usan). */
export function monedaDeTipo(tipo: string): "USD" | "EUR" {
  return tipo.endsWith("EUR") ? "EUR" : "USD";
}

export interface FxFlags {
  esFX: boolean;
  /** Compra/Venta: necesitan cantidad + cotización (mueven disponible en ARS). */
  esCompraOVenta: boolean;
  /** Gasto/Ingreso FX: sólo cantidad, sin cotización ni disponible. */
  esSoloCantidad: boolean;
  moneda: "USD" | "EUR";
}

// ¿El movimiento mueve plata del disponible en ARS? Compra y Venta de divisa sí (salen o
// entran pesos); Ingreso y Gasto FX no: sólo mueven la reserva, sin pasar por pesos.
// Los reportes del período cuentan la economía en pesos, así que excluyen estos últimos.
export function afectaDisponible(tipo: string): boolean {
  if (!esTipoFX(tipo)) return true;
  return tipo.startsWith("Compra") || tipo.startsWith("Venta");
}

export function fxFlags(tipo: string): FxFlags {
  const esFX = esTipoFX(tipo);
  const esCompraOVenta = esFX && (tipo.startsWith("Compra") || tipo.startsWith("Venta"));
  return {
    esFX,
    esCompraOVenta,
    esSoloCantidad: esFX && !esCompraOVenta,
    moneda: monedaDeTipo(tipo),
  };
}

/** parseFloat que nunca devuelve NaN: campo vacío o basura → 0. Sin esto, un input
 *  borrado persistía NaN en Firestore y rompía todos los KPIs (bug de auditoría). */
export function num(v: string | number | undefined | null): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export interface FxInput {
  tipo: string;
  /** "USD" = el usuario tipea la cantidad de divisa; "ARS" = tipea los pesos. */
  modoCarga: "USD" | "ARS";
  cantidadFX: string;
  montoARS: string;
  /** Cotización efectiva (manual si la cargó, si no la del mercado). */
  cotizacion: number;
}

export interface FxResult {
  /** Cantidad de divisa del movimiento. */
  cantidad: number;
  /** Contrapartida en pesos (0 para Gasto/Ingreso FX, que no tocan el disponible). */
  ars: number;
}

// Cantidad y ARS resueltos según el modo de carga. En modo ARS la cantidad se deriva
// dividiendo por la cotización; con cotización 0 devuelve 0 (no Infinity ni NaN).
export function calcularFX({ tipo, modoCarga, cantidadFX, montoARS, cotizacion }: FxInput): FxResult {
  const { esFX, esCompraOVenta, esSoloCantidad } = fxFlags(tipo);
  if (!esFX) return { cantidad: 0, ars: 0 };

  if (esSoloCantidad) return { cantidad: num(cantidadFX), ars: 0 };

  if (modoCarga === "USD") {
    const cantidad = num(cantidadFX);
    return { cantidad, ars: esCompraOVenta ? cantidad * cotizacion : 0 };
  }
  const ars = num(montoARS);
  return { cantidad: cotizacion > 0 ? ars / cotizacion : 0, ars };
}
