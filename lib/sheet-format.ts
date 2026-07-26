import type { Movimiento } from "@/types";
import { aFechaAR } from "@/utils/fecha-ar";

// Neutraliza inyección de fórmulas (Sheets/Excel/CSV): un valor de texto que
// empieza con = + - @ (o tab/CR) sería interpretado como fórmula. Se le antepone
// un apóstrofo para forzar que el motor de planillas lo trate como texto literal.
export function sanitizeCell(v: string | number): string | number {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

// Argentina = UTC-3 (sin horario de verano)
// El form de Google escribe la hora SIN padding (9:48:43), minutos y segundos con padding.
export function formatTimestampAR(date: Date): string {
  const ar = aFechaAR(date);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${ar.getUTCDate()}/${ar.getUTCMonth() + 1}/${ar.getUTCFullYear()} ${ar.getUTCHours()}:${pad(ar.getUTCMinutes())}:${pad(ar.getUTCSeconds())}`;
}

// "YYYY-MM-DD" → "D/M/YYYY" (formato del sheet)
export function isoToFechaAR(fecha: string): string {
  if (!fecha || !fecha.includes("-")) return fecha ?? "";
  const [y, m, d] = fecha.split("-");
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

// Movimiento de Firestore → fila del sheet (orden de columnas A:I)
export function movimientoToRow(m: Movimiento): (string | number)[] {
  return [
    formatTimestampAR(m.timestampCarga),
    isoToFechaAR(m.fecha),
    sanitizeCell(m.tipo),
    sanitizeCell(m.categoria),
    sanitizeCell(m.descripcion ?? ""),
    m.monto,
    sanitizeCell(m.medioPago ?? ""),
    sanitizeCell(m.observaciones ?? ""),
    sanitizeCell(m.periodoId),
  ];
}
