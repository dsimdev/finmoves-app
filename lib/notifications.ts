import { adminDb } from "./firebase-admin";
import { pushYGuardar } from "./notif-store";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { shouldRemind, type RecReminderState } from "@/utils/recurrent-reminder";
import { categoriasEnRiesgo, partirPorEstado } from "@/utils/budget-alert";
import { duracionDisponible, duracionMedianaPeriodos } from "@/utils/duracion-disponible";
import { avanzarHastaFutura } from "@/utils/recordatorio-repeat";
import { fechaISO_AR, fechaISO_AR_haceDias } from "@/utils/fecha-ar";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento, ConfigUsuario } from "@/types";

const DOLAR_THRESHOLD_PCT = 3;
const SUELDO_REMINDER_DAYS = 30; // si pasó ~1 mes sin abrir período nuevo
const CARGA_OLVIDADA_DIAS = 3;   // días sin registrar ningún movimiento
const GASTO_POR_DIA_REAVISO_DIAS = 3; // mientras siga sin llegar a fin de período
// Ventana de lectura (por fecha) para hallar la última carga de un recurrente. Debe cubrir
// el umbral máximo del esquema (día 28 + margen) para que la "última carga" no se pierda:
// si cae fuera de la ventana, el recurrente se ve como nunca-cargado y usa createdAt.
// Los umbrales del esquema (25 / 28 / semanal) viven en utils/recurrent-reminder.
const RECURRENTE_LOOKBACK_DIAS = 40;

// Días entre dos fechas YYYY-MM-DD (b - a), en días enteros.
function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const PRE_AVISO_DIAS = 3; // pre-aviso cuando faltan <= 3 días


// Acción "Cargar" para los avisos que invitan a registrar un movimiento: abre directo
// el modal de alta (deep-link ?nuevo=1). El toque del cuerpo va al listado normal.
const CARGAR_ACCION = {
  actions: [{ action: "cargar", title: "Cargar" }],
  actionUrls: { cargar: "/movements?nuevo=1" },
};

interface GlobalCtx {
  dolarOficial: number | null;
}

// Recorre TODOS los usuarios con suscripción push y manda los avisos que
// correspondan (cambio de dólar, meta de ahorro, recordatorio de sueldo, carga
// olvidada, recordatorios puntuales). Cada aviso deduplica vía config/notifyMeta
// → correr el cron más seguido NO genera spam.
// Optimización: batch-read todos los config/push docs en paralelo, filtrar
// por suscripción activa, luego procesar solo esos usuarios.
export async function notifyAllUsers(ctx: GlobalCtx): Promise<void> {
  const userRefs = await adminDb().collection("users").listDocuments();

  // Leer todos los config/push en paralelo (en lugar de serial en notifyUser).
  const pushDocs = await Promise.all(
    userRefs.map((ref) => adminDb().doc(`${ref.path}/config/push`).get().catch(() => null))
  );

  // Filtrar solo usuarios con suscripción activa. Acepta el formato viejo (`subscription`,
  // una sola) y el nuevo multi-dispositivo (`subscriptions`, array con ≥1 endpoint).
  const tieneSub = (push: FirebaseFirestore.DocumentData | undefined) =>
    !!push?.subscription || (Array.isArray(push?.subscriptions) && push!.subscriptions.length > 0);
  const activeUids = userRefs
    .map((ref, i) => ({ uid: ref.id, push: pushDocs[i]?.data() }))
    .filter(({ push }) => tieneSub(push))
    .map(({ uid }) => uid);

  // Procesar solo usuarios activos.
  await Promise.all(activeUids.map((uid) => notifyUser(uid, ctx).catch((e) => console.error("[notify]", uid, e))));
}

async function notifyUser(uid: string, ctx: GlobalCtx): Promise<void> {
  const notifyRef = adminDb().doc(`users/${uid}/config/notifyMeta`);
  const notify = (await notifyRef.get()).data() ?? {};
  const updates: Record<string, unknown> = {};

  // Cada check corre con su propio catch y los flags se persisten en un finally: un
  // check que falle no puede hacer perder el dedup de un push que otro check YA envió
  // (perderlo re-avisaría duplicado en la próxima corrida — el reverso del bug v2.71.0).
  let falloDiario = false;
  const guardDiario = (p: Promise<void>) => p.catch((e) => { falloDiario = true; console.error("[notify]", uid, e); });

  try {
    await checkDolar(uid, ctx, notify, updates).catch((e) => console.error("[notify]", uid, e));

    // Versión nueva: push una vez por release MINOR/MAJOR (los patches se actualizan
    // solos). Convive con el banner in-app, que es quien hace el hard-refresh.
    await checkVersion(uid, notify, updates).catch((e) => console.error("[notify]", uid, e));

    // Los checks basados en movimientos corren UNA vez por día (no en cada corrida del
    // cron): son recordatorios diarios por naturaleza. El dólar/versión sí corren en
    // cada corrida (arriba) porque no leen movimientos. Esto baja las lecturas 4×→1×.
    const hoy = fechaISO_AR();
    if (notify.lastDailyRun !== hoy) {
      const config = (await adminDb().doc(`users/${uid}/config/meta`).get()).data() as ConfigUsuario | undefined;
      if (config) {
        // Lectura de movimientos recientes compartida por sueldo y carga-olvidada (ambos
        // solo necesitan lo más nuevo). Recurrentes hace su propia lectura por ventana de
        // fecha, porque necesita ver más atrás que estos 150 en períodos de alto volumen.
        const recentSnap = await adminDb()
          .collection(`users/${uid}/movimientos`)
          .orderBy("timestampCarga", "desc")
          .limit(150)
          .get();
        const recientes = recentSnap.docs.map((d) => {
          const data = d.data();
          return { ...data, id: d.id, timestampCarga: (data.timestampCarga as Timestamp).toDate() } as Movimiento;
        });
        await guardDiario(checkSueldo(uid, recientes, notify, updates));
        await guardDiario(checkCargaOlvidada(uid, recientes, notify, updates));
        // Wrapped: el 31/12, avisa que está el resumen anual (necesita los movimientos).
        await guardDiario(checkWrapped(uid, recientes, notify, updates));
        // Desvío de presupuesto: proyecta el cierre del período por categoría y avisa si va
        // camino a pasarse (necesita config para el presupuesto y los movimientos del período).
        await guardDiario(checkPresupuesto(uid, recientes, config, notify, updates));
        // Ritmo de gasto: avisa si al ritmo actual el disponible no llega a fin de período.
        await guardDiario(checkGastoPorDia(uid, recientes, notify, updates));
      }
      // Recurrentes y recordatorios NO dependen de config/meta (viven en sus colecciones):
      // se chequean aunque el doc de config falte.
      await guardDiario(checkRecurrentes(uid, notify, updates));
      await guardDiario(checkRecordatorios(uid));
      // Cerrar el día SOLO si ningún check diario falló: si uno falló, la próxima corrida
      // del cron lo reintenta hoy mismo (los que sí avisaron no repiten: su dedup quedó).
      if (!falloDiario) updates.lastDailyRun = hoy;
    }
  } finally {
    if (Object.keys(updates).length > 0) await notifyRef.set(updates, { merge: true });
  }
}

// Cambio del dólar oficial. El baseline (lastDolarOficial) se re-ancla SOLO al avisar
// con push CONFIRMADO: así medimos el cambio ACUMULADO desde el último aviso (no depende
// de cada cuánto corra la cron) y un envío fallido se reintenta en la próxima corrida
// en vez de silenciar el movimiento para siempre (regla v2.71.0).
async function checkDolar(uid: string, ctx: GlobalCtx, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  if (!ctx.dolarOficial) return;
  const last = notify.lastDolarOficial as number | undefined;
  if (!last) { updates.lastDolarOficial = ctx.dolarOficial; return; } // primer registro
  const deltaPct = ((ctx.dolarOficial - last) / last) * 100;
  if (Math.abs(deltaPct) < DOLAR_THRESHOLD_PCT) return;
  const dir = deltaPct > 0 ? "subió" : "bajó";
  const ok = await pushYGuardar(uid, "dolar", { title: "Dólar oficial", body: `El oficial ${dir} ${Math.abs(deltaPct).toFixed(1)}% · $${ctx.dolarOficial.toLocaleString("es-AR")}`, tag: "dolar", url: "/investments" }, "/investments");
  if (ok) updates.lastDolarOficial = ctx.dolarOficial;
}

// ¿`to` es un salto MINOR o MAJOR respecto de `from`? (los PATCH no avisan).
function esMinorOMajor(from: string, to: string): boolean {
  const [fM, fm] = from.split(".").map(Number);
  const [tM, tm] = to.split(".").map(Number);
  if ([fM, fm, tM, tm].some(Number.isNaN)) return false;
  return tM > fM || (tM === fM && tm > fm);
}

// Aviso de versión nueva. Baseline silencioso para usuarios nuevos (no spamear en
// su primer cron). Avanza el baseline aun en patches, para no acumular el salto.
async function checkVersion(uid: string, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const current = process.env.NEXT_PUBLIC_APP_VERSION;
  if (!current || current === "0") return;
  const last = notify.lastVersionNotified as string | undefined;
  if (!last) { updates.lastVersionNotified = current; return; } // primer registro
  if (current === last) return;
  if (esMinorOMajor(last, current)) {
    const ok = await pushYGuardar(uid, "version", { title: "FinMoves actualizado", body: `Nueva versión v${current} disponible`, tag: `version-${current}`, url: "/settings/help?changelog=1" }, "/settings/help?changelog=1");
    if (!ok) return; // push fallido → no avanzar el baseline, se reintenta la próxima corrida
  }
  updates.lastVersionNotified = current;
}

// Carga olvidada: si pasaron >= N días desde el último movimiento cargado, avisa; y si
// SEGUÍS sin cargar, vuelve a insistir cada CARGA_OLVIDADA_DIAS. Antes el dedup era por
// timestamp del último movimiento: como ese timestamp no cambia mientras no cargues, avisaba
// UNA sola vez y se callaba para siempre — justo cuando más falta hacía. Ahora la cadencia
// se mide por el último día que se avisó (y se reinicia sola al volver a cargar).
async function checkCargaOlvidada(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  if (movs.length === 0) return;
  const ultimo = movs[0].timestampCarga as Date; // más reciente (orden desc)
  const dias = Math.floor((Date.now() - ultimo.getTime()) / 86_400_000);
  if (dias < CARGA_OLVIDADA_DIAS) return;
  const hoy = fechaISO_AR();
  const last = notify.cargaLastNotified as string | undefined;
  // Ya avisé hoy, o hace menos de CARGA_OLVIDADA_DIAS → esperar.
  if (last && diasEntre(last, hoy) < CARGA_OLVIDADA_DIAS) return;
  const ok = await pushYGuardar(uid, "carga", { title: "FinMoves", body: `Hace ${dias} días que no registrás un movimiento`, tag: "carga", url: "/movements", ...CARGAR_ACCION }, "/movements?nuevo=1");
  if (ok) updates.cargaLastNotified = hoy;
}

// Recordatorios puntuales, en dos tiempos:
//  1) Pre-aviso cuando faltan ≤3 días ("en unos días…"), una sola vez (flag avisadoPre).
//  2) El día (o pasado), aviso final y BORRA el recordatorio.
async function checkRecordatorios(uid: string) {
  const hoy = fechaISO_AR();
  // Sin filtro por fecha: los VENCIDOS también tienen que entrar (si el push falló o el
  // cron no corrió ese día, el doc se conservó y hay que reintentarlo; con `fecha >= hoy`
  // quedaban excluidos para siempre). La colección solo guarda pendientes (el aviso
  // final borra el doc), así que leerla entera es barato.
  const snap = await adminDb()
    .collection(`users/${uid}/recordatorios`)
    .get();
  await Promise.all(snap.docs.map(async (doc) => {
    const r = doc.data() as { texto?: string; fecha?: string; avisadoPre?: boolean; repetir?: boolean; diaOriginal?: number };
    if (!r.fecha) return;
    const texto = r.texto ?? "";
    if (r.fecha <= hoy) {
      // Llegó la fecha → aviso final. El doc se toca SOLO si el push se confirmó; si falla,
      // queda como está y se reintenta mañana (si no, el recordatorio se perdería sin avisar).
      const ok = await pushYGuardar(uid, "recordatorio", { title: "Recordatorio", body: texto, tag: `rec-${doc.id}`, url: "/movements" }, "/movements");
      if (!ok) return;
      if (r.repetir) {
        // Repetible: en vez de borrarse, salta al mismo día del mes siguiente. `avanzarHasta
        // Futura` cubre el caso de que el cron haya estado caído varios meses (no queda
        // atrasado avisando todos los días). Se limpia avisadoPre para el ciclo nuevo.
        const proxima = avanzarHastaFutura(r.fecha, hoy, r.diaOriginal);
        await doc.ref.set({ fecha: proxima, avisadoPre: false }, { merge: true }).catch(() => {});
      } else {
        await doc.ref.delete().catch(() => {});
      }
      return;
    }
    // Pre-aviso: faltan entre 1 y 3 días y todavía no se avisó.
    const faltan = diasEntre(hoy, r.fecha);
    if (faltan >= 1 && faltan <= PRE_AVISO_DIAS && !r.avisadoPre) {
      const cuando = faltan === 1 ? "mañana" : `en ${faltan} días`;
      const ok = await pushYGuardar(uid, "recordatorio", { title: "Recordatorio", body: `${cuando}: ${texto}`, tag: `rec-pre-${doc.id}`, url: "/movements" }, "/movements");
      if (ok) await doc.ref.set({ avisadoPre: true }, { merge: true });
    }
  }));
}

// Recurrentes: por cada template activo, calcula su fecha de REFERENCIA = la última carga
// que matchee (tipo+categoría+descripción+observación), o `createdAt` si nunca se cargó.
// Desde esa referencia aplica el esquema día 25 (aviso previo) / 28 (vencido) / luego
// semanal, vía shouldRemind (pura, testeada). Al cargar, la referencia cambia y el ciclo
// se reinicia solo. Dedup por estado {ref,lastNotified,stage} en notify.recReminders.
async function checkRecurrentes(uid: string, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const recSnap = await adminDb().collection(`users/${uid}/recurrentes`).where("activo", "==", true).get();
  if (recSnap.empty) return;

  // Ventana por FECHA del evento: una sola query, index-free y robusta al volumen. Cubre
  // el umbral (28d) con margen para hallar la última carga. `fecha` se guarda como YYYY-MM-DD.
  const desde = fechaISO_AR_haceDias(RECURRENTE_LOOKBACK_DIAS);
  const movsSnap = await adminDb()
    .collection(`users/${uid}/movimientos`)
    .where("fecha", ">=", desde)
    .get();
  const movs = movsSnap.docs.map((d) => d.data() as Movimiento);

  const hoy = fechaISO_AR();
  const reminders = (notify.recReminders as Record<string, RecReminderState>) ?? {};
  const activeIds = new Set(recSnap.docs.map((d) => d.id));
  // Limpieza: descartar del dedup las claves de templates borrados/inactivos (no crecer sin fin).
  const nextReminders: Record<string, RecReminderState> = {};
  for (const [k, v] of Object.entries(reminders)) if (activeIds.has(k)) nextReminders[k] = v;

  const nombres: string[] = [];
  const ids: string[] = [];

  for (const d of recSnap.docs) {
    const r = d.data() as { tipo: string; categoria: string; descripcion: string; observaciones?: string; createdAt?: number };
    // Última carga que matchee (misma clave que el relojito/doc). La observación distingue
    // recurrentes homónimos (ej. "Steam·eso+" vs "Steam·eso pass").
    const desc = (r.descripcion || "").trim().toLowerCase();
    const obs = (r.observaciones || "").trim().toLowerCase();
    let ultima = "";
    for (const m of movs) {
      if (m.tipo !== r.tipo || m.categoria !== r.categoria) continue;
      if ((m.descripcion || "").trim().toLowerCase() !== desc || !m.fecha) continue;
      if ((m.observaciones || "").trim().toLowerCase() !== obs) continue;
      if (m.fecha > ultima) ultima = m.fecha;
    }
    // Referencia = última carga, o createdAt si nunca se cargó (recurrente nuevo). Si no hay
    // ninguna de las dos (raro), se saltea.
    const ref = ultima || (r.createdAt ? fechaISO_AR(r.createdAt) : "");
    if (!ref) continue;

    const nuevo = shouldRemind(ref, hoy, reminders[d.id]);
    if (!nuevo) continue;
    nombres.push(r.descripcion);
    ids.push(d.id);
    nextReminders[d.id] = nuevo;
  }

  if (nombres.length === 0) return;
  const body = nombres.length === 1
    ? `¿Cargás "${nombres[0]}"? Es tu recurrente y hace rato no lo registrás.`
    : `${nombres.length} recurrentes pendientes: ${nombres.slice(0, 3).join(", ")}${nombres.length > 3 ? "…" : ""}`;
  const dest = ids.length === 1 ? `/movements?recurrente=${encodeURIComponent(ids[0])}` : "/movements";
  // Tag por día: dos recurrentes que avisan en días distintos no se pisan en el tray.
  // Dedup SOLO si el push se confirmó: si falla, reintenta mañana (no marca el estado nuevo).
  const ok = await pushYGuardar(uid, "recurrente", { title: "Recurrentes", body, tag: `rec-${hoy}`, url: dest, actions: [{ action: "cargar", title: "Cargar" }], actionUrls: { cargar: dest } }, dest);
  if (ok) updates.recReminders = nextReminders;
}

// Los hitos de meta (50/75/100%) NO se notifican por push: tanto los ahorros acumulados
// (metaPropia) como la reserva en divisa (metaFX) sólo se mueven cuando el usuario carga un
// movimiento, o sea que está mirando la app en ese preciso momento. El cron corría después y
// repetía algo ya visto (o lo avisaba al día siguiente). El festejo vive in-app, al cruzar el
// hito: components/investments/MetaCelebration + utils/meta-hitos.
// El dólar (checkDolar) SÍ sigue por push: la cotización se mueve sin que el usuario haga nada.

// Wrapped (resumen anual): el 31/12 avisa UNA vez que está disponible el recap del año.
// El botón vive en Reportes y se ofrece del 26/12 al 5/1; este push es el empujón del día.
// Dedup por año (wrappedNotifiedYear) → si el cron corre varias veces ese día, avisa una sola.
async function checkWrapped(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const hoy = fechaISO_AR();                 // YYYY-MM-DD (AR)
  if (hoy.slice(5) !== "12-31") return; // solo el 31/12
  const año = hoy.slice(0, 4);
  if (notify.wrappedNotifiedYear === año) return; // ya avisé este año
  // Solo si tiene movimientos de este año (si no, el recap estaría vacío).
  if (!movs.some((m) => m.fecha?.startsWith(año))) return;
  const ok = await pushYGuardar(uid, "wrapped", { title: "Tu año en FinMoves", body: `Ya podés ver tu resumen de ${año} 🎉`, tag: `wrapped-${año}`, url: "/reports" }, "/reports");
  if (ok) updates.wrappedNotifiedYear = año;
}

// Desvío de presupuesto: proyecta, al ritmo del período en curso, si alguna categoría va a
// cerrar por encima de su presupuesto, y avisa ANTES de pasarse. La lógica (proyección +
// guarda de "período ya avanzado" + umbral) vive en utils/budget-alert (pura, testeada).
// Dedup: máx 1 aviso por categoría por período. `budgetAvisos` = { [periodoId]: string[] }.
// Solo se conserva la entrada del período en curso (los viejos se descartan solos).
async function checkPresupuesto(uid: string, movs: Movimiento[], config: ConfigUsuario, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const periodos = agruparPorPeriodo(movs);
  if (periodos.length === 0) return;
  const actual = periodos[0]; // el más nuevo = período en curso

  // Presupuesto efectivo: override del período (colección presupuestos/) o el template de config.
  const safeId = actual.periodoId.replace(/\//g, "_");
  const override = (await adminDb().doc(`users/${uid}/presupuestos/${safeId}`).get()).data() as
    | { categorias?: Record<string, number> } | undefined;
  const presupuesto = override?.categorias ?? config.meta.presupuestoTemplate ?? {};
  if (Object.keys(presupuesto).length === 0) return;

  // Gasto por categoría del período (Gasto y CompraUSD cuentan, igual que en reportes).
  const gastadoPorCategoria: Record<string, number> = {};
  for (const m of actual.movimientos) {
    if (m.tipo === "Gasto" || m.tipo === "CompraUSD") {
      gastadoPorCategoria[m.categoria] = (gastadoPorCategoria[m.categoria] ?? 0) + m.monto;
    }
  }

  // Días transcurridos del período en curso (mismo cálculo que ritmoGasto: hoy − inicio).
  const inicio = parsePeriodoId(actual.periodoId);
  const dias = Math.max(1, Math.round((Date.now() - inicio.getTime()) / 86_400_000));

  const avisadas = ((notify.budgetAvisos as Record<string, string[]>) ?? {})[actual.periodoId] ?? [];
  const todas = categoriasEnRiesgo(gastadoPorCategoria, presupuesto, dias, avisadas);
  if (todas.length === 0) return;

  // Pasarse ya es un hecho consumado; ir camino a pasarse todavía se puede corregir. Se avisa
  // lo más urgente primero (lo excedido), con el mismo criterio que usa la app al abrirse.
  const { excedidas, enRiesgo } = partirPorEstado(todas);
  const title = excedidas.length > 0 ? "Presupuesto excedido" : "Presupuesto";
  const body = excedidas.length > 0
    ? (excedidas.length === 1
        ? `${excedidas[0].categoria} se pasó · ${excedidas[0].pctGastado}% del presupuesto`
        : `${excedidas.length} categorías ya se pasaron${enRiesgo.length > 0 ? ` y ${enRiesgo.length} van camino` : ""}`)
    : (enRiesgo.length === 1
        ? `A este ritmo, ${enRiesgo[0].categoria} cierra en ${enRiesgo[0].pctProyectado}% de su presupuesto.`
        : `${enRiesgo.length} categorías van camino a pasarse: ${enRiesgo.slice(0, 3).map((c) => c.categoria).join(", ")}${enRiesgo.length > 3 ? "…" : ""}`);

  const ok = await pushYGuardar(uid, "presupuesto", { title, body, tag: `presu-${safeId}`, url: "/reports" }, "/reports");
  // Dedup SOLO si el push se confirmó (regla v2.71.0). Se marcan TODAS las avisadas ahora y se
  // deja únicamente la entrada del período en curso, para no acumular períodos viejos.
  if (ok) updates.budgetAvisos = { [actual.periodoId]: [...avisadas, ...todas.map((c) => c.categoria)] };
}

// "Podés gastar $X hoy": avisa SOLO si al ritmo actual el disponible no llega a fin de
// período (duracionDisponible.llega === false) — mismo espíritu que el desvío de presupuesto,
// avisar cuando hay que corregir algo, no un informativo diario. Reavisa cada
// GASTO_POR_DIA_REAVISO_DIAS mientras el problema persista (igual cadencia que carga
// olvidada): si en el ínterin cargás algo y el ritmo mejora, el check simplemente deja de
// disparar solo (no hace falta limpiar el dedup a mano).
async function checkGastoPorDia(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const periodos = agruparPorPeriodo(movs);
  if (periodos.length === 0) return;
  const actual = periodos[0]; // el más nuevo = período en curso

  const inicio = parsePeriodoId(actual.periodoId);
  const dias = Math.max(1, Math.round((Date.now() - inicio.getTime()) / 86_400_000));
  const largo = duracionMedianaPeriodos(periodos.map((p) => parsePeriodoId(p.periodoId)));
  // Mismo criterio que Inicio: lo que REALMENTE baja el disponible (gasto + lo movido a
  // ahorros), no solo gastadoPuro (ver comentario en app/(tabs)/page.tsx).
  const consumido = actual.gastado + actual.moveAhorros;
  const dur = duracionDisponible(actual.disponible, consumido, dias, largo);
  if (dur.llega || dur.porDiaSugerido === null) return;

  const hoy = fechaISO_AR();
  const last = notify.gastoPorDiaLastNotified as string | undefined;
  if (last && diasEntre(last, hoy) < GASTO_POR_DIA_REAVISO_DIAS) return;

  const body = `A este ritmo no llegás a fin de período. Podés gastar ${Math.round(dur.porDiaSugerido).toLocaleString("es-AR")} por día para llegar.`;
  const ok = await pushYGuardar(uid, "ritmo", { title: "Ritmo de gasto", body, tag: `gastodia-${actual.periodoId}`, url: "/" }, "/");
  if (ok) updates.gastoPorDiaLastNotified = hoy;
}

// Recordatorio de sueldo: si pasó más de ~1 mes desde el último período abierto.
async function checkSueldo(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const periodos = agruparPorPeriodo(movs);
  if (periodos.length === 0) return;
  const ultimo = periodos[0].periodoId;
  const inicio = parsePeriodoId(ultimo);
  const dias = (Date.now() - inicio.getTime()) / 86_400_000;
  if (dias < SUELDO_REMINDER_DAYS) return;
  if (notify.sueldoRemindedFor === ultimo) return; // ya avisé por este gap

  // Marcar el dedup SOLO si el push se confirmó: un fallo transitorio se reintenta mañana.
  const ok = await pushYGuardar(uid, "sueldo", { title: "FinMoves", body: "Pasó más de un mes: ¿cargás el sueldo del nuevo período?", tag: "sueldo", url: "/movements?nuevo=1" }, "/movements?nuevo=1");
  if (ok) updates.sueldoRemindedFor = ultimo;
}
