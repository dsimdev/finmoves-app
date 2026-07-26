import { categoriasEnRiesgo, partirPorEstado } from "./budget-alert";
import { shouldRemind } from "./recurrent-reminder";
import { recurrentKey } from "./recurrent-key";
import { fechaISO_AR } from "./fecha-ar";
import type { Movimiento, ConfigUsuario } from "@/types";
import type { Recurrente } from "@/services/firebase/recurrentes";
import type { InAppMeta, NotifNueva } from "@/services/firebase/notificaciones";

// Qué anotar en la campana al ABRIR la app. El cron corre cada varias horas; entre corridas
// el dólar se mueve y los gastos cambian el desvío del presupuesto, así que la bandeja queda
// atrasada respecto de lo que ya pasó. Acá se evalúan los mismos checks contra el estado
// actual y se devuelve lo que falta registrar — sin push: interrumpir sigue siendo del cron.
//
// El dedup usa una marca PROPIA del cliente (InAppMeta), separada de la del cron: así el cron
// conserva su baseline y sigue mandando sus push igual que siempre.
//
// Las reglas NO se reescriben acá: se importan las mismas funciones puras que usa el cron
// (categoriasEnRiesgo, shouldRemind), para que los dos caminos no puedan divergir.

const DOLAR_THRESHOLD_PCT = 3;   // mismo umbral que checkDolar en el cron
const PRE_AVISO_DIAS = 3;        // mismo que checkRecordatorios

export interface EstadoInApp {
  meta: InAppMeta;
  /** Dedup de presupuesto COMPARTIDO con el cron (notifyMeta.budgetAvisos). */
  budgetAvisos?: Record<string, string[]>;
  dolarOficial: number | null;
  appVersion?: string;
  movimientos: Movimiento[];
  config: ConfigUsuario | null;
  recurrentes: Recurrente[];
  /** Recordatorios pendientes (los que el cron todavía no borró). */
  recordatorios: { id: string; texto: string; fecha: string }[];
  /** Presupuesto efectivo del período en curso, por categoría. */
  presupuesto: Record<string, number>;
  periodoActual: { periodoId: string; movimientos: Movimiento[] } | null;
  diasTranscurridos: number;
  /** Hoy en AR, YYYY-MM-DD. */
  hoy: string;
  /** periodoId del período que CERRÓ (el segundo más nuevo), o null si nunca cerró uno. */
  periodoCerrado: string | null;
}

export interface ResultadoInApp {
  nuevas: NotifNueva[];
  /** Cómo queda la marca del cliente si las nuevas se escriben. */
  meta: InAppMeta;
  /** Dedup de presupuesto actualizado (se guarda en el campo que comparte con el cron). */
  budgetAvisos?: Record<string, string[]>;
}

/** Días enteros entre dos fechas YYYY-MM-DD (b − a). */
const diasEntre = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};

export function notificacionesPendientes(e: EstadoInApp): ResultadoInApp {
  const nuevas: NotifNueva[] = [];
  const meta: InAppMeta = { ...e.meta };
  let budgetAvisos: Record<string, string[]> | undefined;

  // ── Dólar: variación acumulada desde lo último que anotó el cliente ────────
  if (e.dolarOficial) {
    const base = e.meta.dolar;
    if (base === undefined) {
      meta.dolar = e.dolarOficial; // primer registro: solo ancla, no avisa
    } else {
      const deltaPct = ((e.dolarOficial - base) / base) * 100;
      if (Math.abs(deltaPct) >= DOLAR_THRESHOLD_PCT) {
        const dir = deltaPct > 0 ? "subió" : "bajó";
        nuevas.push({
          tipo: "dolar", title: "Dólar oficial",
          body: `El oficial ${dir} ${Math.abs(deltaPct).toFixed(1)}% · $${e.dolarOficial.toLocaleString("es-AR")}`,
          dest: "/investments",
        });
        meta.dolar = e.dolarOficial;
      }
    }
  }

  // ── Versión nueva ─────────────────────────────────────────────────────────
  if (e.appVersion && e.appVersion !== "0") {
    if (e.meta.version === undefined) {
      meta.version = e.appVersion; // ancla silenciosa para el que entra por primera vez
    } else if (e.meta.version !== e.appVersion) {
      nuevas.push({
        tipo: "version", title: "FinMoves actualizado",
        body: `Nueva versión v${e.appVersion} disponible`,
        dest: "/settings/help?changelog=1",
      });
      meta.version = e.appVersion;
    }
  }

  // ── Desvío de presupuesto del período en curso ────────────────────────────
  // El dedup se COMPARTE con el cron (budgetAvisos): si no, cada canal llevaría su cuenta y
  // la misma categoría se anotaría dos veces (una por el push, otra al abrir la app).
  if (e.periodoActual && Object.keys(e.presupuesto).length > 0) {
    const gastado: Record<string, number> = {};
    for (const m of e.periodoActual.movimientos) {
      if (m.tipo === "Gasto" || m.tipo === "CompraUSD") {
        gastado[m.categoria] = (gastado[m.categoria] ?? 0) + m.monto;
      }
    }
    const yaAvisadas = e.budgetAvisos?.[e.periodoActual.periodoId] ?? [];
    const todas = categoriasEnRiesgo(gastado, e.presupuesto, e.diasTranscurridos, yaAvisadas);
    // Dos avisos distintos: pasarse ya es un hecho consumado; ir camino a pasarse todavía se
    // puede corregir. Mezclarlos en un mismo mensaje decía algo falso de la mitad de ellas.
    const { excedidas, enRiesgo } = partirPorEstado(todas);

    if (excedidas.length > 0) {
      const p = excedidas[0];
      nuevas.push({
        tipo: "presupuesto", title: "Presupuesto excedido",
        body: excedidas.length === 1
          ? `${p.categoria} se pasó · ${p.pctGastado}% del presupuesto`
          : `${excedidas.length} categorías ya se pasaron`,
        detalle: excedidas.map((c) => `${c.categoria} · ${c.pctGastado}% de lo presupuestado`).join("\n"),
        dest: "/reports",
      });
    }
    if (enRiesgo.length > 0) {
      const p = enRiesgo[0];
      nuevas.push({
        tipo: "presupuesto", title: "Presupuesto",
        body: enRiesgo.length === 1
          ? `${p.categoria} cierra en ${p.pctProyectado}% a este ritmo`
          : `${enRiesgo.length} categorías van camino a pasarse`,
        detalle: enRiesgo.map((c) => `${c.categoria} · proyecta ${c.pctProyectado}%`).join("\n"),
        dest: "/reports",
      });
    }
    if (todas.length > 0) {
      // Se escribe en el MISMO campo que usa el cron, conservando solo el período en curso.
      budgetAvisos = { [e.periodoActual.periodoId]: [...yaAvisadas, ...todas.map((c) => c.categoria)] };
    }
  }

  // ── Recurrentes pendientes de cargar ──────────────────────────────────────
  // Máx. 1 aviso por día (el cron ya lleva su propio estado por template).
  if (e.meta.recurrentes !== e.hoy) {
    const activos = e.recurrentes.filter((r) => r.activo);
    const pendientes: string[] = [];
    for (const r of activos) {
      const clave = recurrentKey(r);
      // Última carga que matchee la clave del recurrente (misma que usa el cron).
      let ultima = "";
      for (const m of e.movimientos) {
        if (recurrentKey(m) !== clave || !m.fecha) continue;
        if (m.fecha > ultima) ultima = m.fecha;
      }
      const ref = ultima || (r.createdAt ? fechaISO_AR(r.createdAt) : "");
      if (!ref) continue;
      if (shouldRemind(ref, e.hoy, undefined)) pendientes.push(r.descripcion);
    }
    if (pendientes.length > 0) {
      nuevas.push({
        tipo: "recurrente", title: "Recurrentes",
        body: pendientes.length === 1
          ? `¿Cargás "${pendientes[0]}"?`
          : `${pendientes.length} recurrentes pendientes`,
        detalle: pendientes.join("\n"),
        dest: "/movements",
      });
      meta.recurrentes = e.hoy;
    }
  }

  // ── Recap de cierre de período ────────────────────────────────────────────
  // Cuando cerrás un período (se abre el siguiente) hay un recap del que terminó. Se avisa una
  // vez por período cerrado, con el MISMO dedup que usa el botón de Reportes (recapVisto): si
  // ya lo viste o ya se avisó, no repite. El tap lleva a Reportes, donde está el panel.
  if (e.periodoCerrado && e.meta.recapAvisado !== e.periodoCerrado && e.meta.recapVisto !== e.periodoCerrado) {
    nuevas.push({
      tipo: "wrapped", title: "Cierre de período",
      body: "Ya podés ver el resumen del período que cerraste",
      dest: "/reports",
    });
    meta.recapAvisado = e.periodoCerrado;
  }

  // ── Pre-aviso de recordatorios ────────────────────────────────────────────
  // SOLO el pre-aviso (faltan 1..3 días). El aviso del día lo hace el cron, que además borra
  // el recordatorio: el cliente no se mete ahí para no pisarle esa baja.
  // Dedup por id: sin esto se re-anotaría en CADA apertura mientras dure la ventana.
  const preAvisados = e.meta.recordatoriosPre ?? [];
  const yaPre = new Set(preAvisados);
  const preNuevos: string[] = [];
  for (const r of e.recordatorios) {
    if (!r.fecha || yaPre.has(r.id)) continue;
    const faltan = diasEntre(e.hoy, r.fecha);
    if (faltan < 1 || faltan > PRE_AVISO_DIAS) continue;
    const cuando = faltan === 1 ? "mañana" : `en ${faltan} días`;
    nuevas.push({ tipo: "recordatorio", title: "Recordatorio", body: `${cuando}: ${r.texto}`, dest: "/movements" });
    preNuevos.push(r.id);
  }
  if (preNuevos.length > 0) {
    // Se conservan solo los ids que siguen existiendo, para que la lista no crezca sin fin.
    const vivos = new Set(e.recordatorios.map((r) => r.id));
    meta.recordatoriosPre = [...preAvisados.filter((id) => vivos.has(id)), ...preNuevos];
  }

  return { nuevas, meta, budgetAvisos };
}
