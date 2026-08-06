import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

// Tipos de aviso que persistimos para el panel in-app (bandeja). El destino (`dest`)
// es el deep-link al que navega el tap; lo escribe el backend al enviar el push.
export type NotifTipo =
  | "dolar" | "version" | "recurrente" | "sueldo" | "carga"
  | "meta" | "recordatorio" | "permiso" | "sync" | "baja" | "wrapped" | "presupuesto" | "ritmo";

export interface Notificacion {
  id: string;
  tipo: NotifTipo;
  title: string;
  /** Resumen de UNA línea: es lo que se ve en la bandeja sin expandir. */
  body: string;
  /** Desglose completo (líneas separadas por \n). Se muestra al expandir la notificación. */
  detalle?: string;
  dest: string;      // deep-link (ej. "/investments", "/movements?recurrente=<id>")
  createdAt: number;
  leida: boolean;
}

export async function listarNotificaciones(uid: string): Promise<Notificacion[]> {
  const q = query(collection(db, `users/${uid}/notificaciones`), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notificacion, "id">) }));
}

export async function marcarLeida(uid: string, id: string): Promise<void> {
  await updateDoc(doc(db, `users/${uid}/notificaciones/${id}`), { leida: true });
}

export async function eliminarNotificacion(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, `users/${uid}/notificaciones/${id}`));
}

export async function marcarTodasLeidas(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids) batch.update(doc(db, `users/${uid}/notificaciones/${id}`), { leida: true });
  await batch.commit();
}

// ── Registro desde el cliente (sin push) ─────────────────────────────────────
// El cron corre cada varias horas; entre corridas el dólar se mueve y los gastos cambian el
// desvío del presupuesto. Al abrir la app se evalúan esos checks contra el estado actual y lo
// que falte se registra ACÁ, en la misma bandeja — sin mandar push (para eso está el cron).

export interface NotifNueva {
  tipo: NotifTipo;
  title: string;
  body: string;
  detalle?: string;
  dest: string;
}

/** Agrega notificaciones a la bandeja. Devuelve cuántas se escribieron. */
export async function agregarNotificaciones(uid: string, nuevas: NotifNueva[]): Promise<number> {
  if (nuevas.length === 0) return 0;
  const col = collection(db, `users/${uid}/notificaciones`);
  const batch = writeBatch(db);
  for (const n of nuevas) {
    // `detalle` es opcional: Firestore rechaza undefined, así que solo va si existe.
    const { detalle, ...resto } = n;
    batch.set(doc(col), { ...resto, ...(detalle ? { detalle } : {}), createdAt: Date.now(), leida: false });
  }
  await batch.commit();
  return nuevas.length;
}

/**
 * Marca del cliente para saber qué ya registró (separada de la del cron, en
 * `config/notifyMeta`): así el cron sigue mandando sus push sin que el cliente le mueva el
 * baseline. Se dedupea por valor para no anotar dos veces el mismo evento.
 */
export interface InAppMeta {
  /** Último valor del dólar por el que se anotó una variación. */
  dolar?: number;
  /** Última versión de la app anotada. */
  version?: string;
  /**
   * @deprecated El dedup de presupuesto pasó a compartirse con el cron (`budgetAvisos`), para
   * que una categoría no se avise dos veces (una por cada canal). Se conserva el campo por los
   * datos viejos; ningún cálculo lo lee.
   */
  presupuesto?: Record<string, string[]>;
  /** Fecha (YYYY-MM-DD) del último aviso de recurrentes pendientes. */
  recurrentes?: string;
  /** Ids de recordatorios cuyo pre-aviso ya se anotó (se purgan al desaparecer el doc). */
  recordatoriosPre?: string[];
  /** periodoId del último recap de cierre ya visto (el recap se ofrece hasta verse una vez). */
  recapVisto?: string;
  /** periodoId del último cierre por el que ya se anotó la notificación in-app. */
  recapAvisado?: string;
}

/**
 * Lee el doc que comparten el cron y el cliente: `inApp` es la marca propia del cliente y
 * `budgetAvisos` el dedup de presupuesto que ambos comparten (una categoría se avisa una vez
 * por período, la detecte quien la detecte).
 */
export async function leerNotifyMeta(uid: string): Promise<{ inApp: InAppMeta; budgetAvisos?: Record<string, string[]> }> {
  const snap = await getDoc(doc(db, `users/${uid}/config/notifyMeta`));
  const data = snap.data() ?? {};
  return {
    inApp: (data.inApp ?? {}) as InAppMeta,
    budgetAvisos: data.budgetAvisos as Record<string, string[]> | undefined,
  };
}

export async function guardarNotifyMeta(uid: string, inApp: InAppMeta, budgetAvisos?: Record<string, string[]>): Promise<void> {
  await setDoc(
    doc(db, `users/${uid}/config/notifyMeta`),
    { inApp, ...(budgetAvisos ? { budgetAvisos } : {}) },
    { merge: true }
  );
}

