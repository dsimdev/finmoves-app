import { adminDb } from "./firebase-admin";
import type { PushPayload } from "./web-push";
import { sendPushToUser } from "./web-push";

const MAX_NOTIFS = 30; // bandeja acotada: al escribir, podamos las más viejas.

type NotifTipo =
  | "dolar" | "version" | "recurrente" | "sueldo" | "carga"
  | "meta" | "recordatorio" | "permiso" | "sync" | "baja" | "wrapped" | "presupuesto" | "ritmo";

// Envía el push Y, si se confirma, persiste la notif en la bandeja in-app (colección
// /notificaciones) con su deep-link `dest`. Devuelve `true` sólo si el push se confirmó,
// para que el caller deduplique igual que antes (dedup sólo si envió). El guardado es
// best-effort: no bloquea ni revierte el envío si Firestore falla.
export async function pushYGuardar(
  uid: string,
  tipo: NotifTipo,
  payload: PushPayload,
  dest: string,
): Promise<boolean> {
  const ok = await sendPushToUser(uid, payload);
  if (!ok) return false;
  try {
    const col = adminDb().collection(`users/${uid}/notificaciones`);
    await col.add({ tipo, title: payload.title, body: payload.body, dest, createdAt: Date.now(), leida: false });
    // Podar: si superó el máximo, borrar las más viejas. `count()` cuesta 1 lectura de
    // agregación (no ~MAX_NOTIFS lecturas de doc como el viejo `.offset(MAX)`), y solo
    // leemos los docs a borrar cuando efectivamente hay exceso.
    const total = (await col.count().get()).data().count;
    if (total > MAX_NOTIFS) {
      const snap = await col.orderBy("createdAt", "desc").offset(MAX_NOTIFS).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete().catch(() => {})));
    }
  } catch (e) {
    console.error("[notif-store]", uid, e);
  }
  return true;
}
