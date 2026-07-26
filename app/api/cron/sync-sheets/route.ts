import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { pushYGuardar } from "@/lib/notif-store";
import { notifyAllUsers } from "@/lib/notifications";
import { mesISO_AR } from "@/utils/fecha-ar";
import { Timestamp } from "firebase-admin/firestore";

// Cotización oficial del dólar (una sola vez, se reparte a todos los usuarios).
async function fetchDolarOficial(): Promise<number | null> {
  try {
    const res = await fetch("https://api.bluelytics.com.ar/v2/latest", { cache: "no-store" });
    const json = await res.json();
    return (json?.oficial?.value_sell as number | undefined) ?? null;
  } catch {
    return null;
  }
}

// Cloud Scheduler invoca esta ruta con Authorization: Bearer <CRON_SECRET>.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerUid = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (!ownerUid) {
    return NextResponse.json({ error: "OWNER_UID not set" }, { status: 500 });
  }

  // ── 1) Backup a Google Sheets — SOLO el dueño (es su funcionalidad) ──
  const syncMetaRef = adminDb().doc(`users/${ownerUid}/config/syncMeta`);

  // El sync a Sheets YA NO corre automático: la app confía en Firestore y el Sheet queda
  // como backup ocasional que el dueño dispara a mano. El cron solo AVISA cuando pasaron
  // >30 días desde el último sync (manual), para que decida cuándo hacer el respaldo.
  // Dedup por mes calendario (via lastStaleNotified) → no repite el aviso todos los días.
  const SYNC_STALE_MS = 30 * 24 * 60 * 60 * 1000;
  const syncMeta = (await syncMetaRef.get()).data() ?? {};
  const lastSync = syncMeta.lastSync as Timestamp | undefined;
  const lastStaleNotified = syncMeta.lastStaleNotified as string | undefined;
  const mesActual = mesISO_AR(); // YYYY-MM (AR)
  const stale = !lastSync || Date.now() - lastSync.toMillis() > SYNC_STALE_MS;

  let result: { ok: boolean; stale?: boolean; notified?: boolean };
  if (stale && lastStaleNotified !== mesActual) {
    const dias = lastSync ? Math.floor((Date.now() - lastSync.toMillis()) / 86_400_000) : null;
    const ok = await pushYGuardar(ownerUid, "sync", {
      title: "Backup de Sheets pendiente",
      body: dias ? `Hace ${dias} días que no respaldás. Sincronizá cuando quieras.` : "Todavía no respaldaste a Sheets. Sincronizá cuando quieras.",
      tag: "sync-stale", url: "/settings/data",
    }, "/settings/data");
    if (ok) await syncMetaRef.set({ lastStaleNotified: mesActual }, { merge: true });
    result = { ok: true, stale: true, notified: ok };
  } else {
    result = { ok: true, stale };
  }

  // ── 1.5) Limpieza de códigos de invitación sin uso vencidos (>24h) ──
  try {
    const CODE_TTL_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const codesSnap = await adminDb().collection("inviteCodes").get();
    await Promise.all(codesSnap.docs.map(async (d) => {
      const data = d.data() as { used?: boolean; createdAt?: Timestamp };
      if (data.used) return;
      const createdAt = data.createdAt?.toMillis() ?? 0;
      if (createdAt && now - createdAt > CODE_TTL_MS) await d.ref.delete().catch(() => {});
    }));
  } catch (err) {
    console.error("[cron/codes-cleanup]", err);
  }

  // ── 1.6) Limpieza de contadores de rate-limit vencidos (resetAt en el pasado) ──
  try {
    const rlSnap = await adminDb().collection("rateLimits").where("resetAt", "<", Date.now()).get();
    await Promise.all(rlSnap.docs.map((d) => d.ref.delete().catch(() => {})));
  } catch (err) {
    console.error("[cron/ratelimit-cleanup]", err);
  }

  // ── 2) Avisos para TODOS los usuarios (versión, dólar, meta, sueldo) ──
  // Idempotente: deduplica vía config/notifyMeta, así correrlo más seguido no spamea.
  try {
    await notifyAllUsers({
      dolarOficial: await fetchDolarOficial(),
    });
  } catch (err) {
    console.error("[cron/notify]", err);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
