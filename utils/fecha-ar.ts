// Fecha en horario de Argentina (UTC-3), centralizado.
//
// Antes cada archivo hacía `new Date(Date.now() - 3 * 60 * 60 * 1000)` a mano — repetido en 14
// lugares. Eso trae dos problemas: (1) leer el reloj en el cuerpo de un componente es impuro y
// da renders inconsistentes (el lint `react-hooks/purity` lo marca), y (2) el offset a mano
// tendría que corregirse en 14 sitios si algún día vuelve el horario de verano.
//
// Argentina no observa DST desde 2009, así que el offset fijo -3 es correcto hoy. Si eso
// cambiara, este es el ÚNICO lugar a tocar.

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Una fecha cualquiera desplazada a hora AR (para leerle campos UTC como si fueran locales AR). */
export function aFechaAR(fecha: Date | number): Date {
  const ms = typeof fecha === "number" ? fecha : fecha.getTime();
  return new Date(ms - AR_OFFSET_MS);
}

/** Hoy en AR como objeto Date. Impuro (lee el reloj): usar fuera del render. */
export function ahoraAR(): Date {
  return aFechaAR(Date.now());
}

/** YYYY-MM-DD de una fecha en hora AR. Sin argumento, hoy. */
export function fechaISO_AR(fecha: Date | number = Date.now()): string {
  return aFechaAR(fecha).toISOString().slice(0, 10);
}

/** YYYY-MM (mes) de una fecha en hora AR. Sin argumento, este mes. */
export function mesISO_AR(fecha: Date | number = Date.now()): string {
  return aFechaAR(fecha).toISOString().slice(0, 7);
}

/** YYYY-MM-DD (AR) de hace N días — para acotar ventanas por fecha. */
export function fechaISO_AR_haceDias(dias: number): string {
  return fechaISO_AR(Date.now() - dias * 86_400_000);
}
