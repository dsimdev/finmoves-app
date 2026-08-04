import { adminDb } from "@/lib/firebase-admin";
import { getSheetsClient, getSheetName, backupAndRotate, overwriteData, appendData, createSpreadsheet, isNotFound, ENV_SPREADSHEET_ID } from "@/lib/google-sheets";
import { movimientoToRow } from "@/lib/sheet-format";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento } from "@/types";

// Espejo app → Google Sheets. El sheet solo lo escribe la app (nadie edita directo
// en la hoja), así que su estado es exactamente lo del último sync. Eso habilita:
// - incremental (default): lee solo movimientos posteriores al último sincronizado
//   (syncMeta.lastSyncedTs) y los agrega al final. Costo: ~N docs nuevos.
// - full: lee toda la colección, respalda/rota la hoja y la sobrescribe. Corre si la
//   app editó/borró un movimiento (flag syncMeta.needsFullSync), si nunca hubo sync
//   (sin lastSyncedTs) o si se fuerza (sync manual desde Configuración).
// Actualiza users/{uid}/config/syncMeta (lastSync / lastError). Lanza si algo falla.
export async function syncUserMovimientosToSheet(
  uid: string,
  opts?: { forceFull?: boolean }
): Promise<{ synced: number; mode: "full" | "incremental" }> {
  const syncMetaRef = adminDb().doc(`users/${uid}/config/syncMeta`);
  try {
    const meta = (await syncMetaRef.get()).data() ?? {};
    const lastSyncedTs = meta.lastSyncedTs as Timestamp | undefined;
    // ID vigente: el guardado en Firestore (si se recreó la hoja) o el del env como fallback.
    let spreadsheetId = (meta.spreadsheetId as string | undefined) || ENV_SPREADSHEET_ID;
    let full = opts?.forceFull === true || meta.needsFullSync === true || !lastSyncedTs;

    const col = adminDb().collection(`users/${uid}/movimientos`);
    const readSnap = async (isFull: boolean) => isFull
      ? await col.orderBy("timestampCarga", "asc").get()
      : await col.where("timestampCarga", ">", lastSyncedTs!).orderBy("timestampCarga", "asc").get();

    let snap = await readSnap(full);
    const toRows = (s: FirebaseFirestore.QuerySnapshot) => s.docs.map((doc) => {
      const data = doc.data();
      const m = { ...data, id: doc.id, timestampCarga: (data.timestampCarga as Timestamp).toDate() } as Movimiento;
      return movimientoToRow(m);
    });

    // Escribe en la hoja. Si la hoja no existe (404: fue borrada, o el ID es inválido), crea
    // una nueva, guarda su ID y reintenta como FULL (la hoja nueva arranca vacía).
    const sheets = await getSheetsClient();
    const escribir = async () => {
      const rows = toRows(snap);
      if (!full && rows.length === 0) return rows; // incremental sin novedades: nada que escribir
      const sheetName = await getSheetName(sheets, spreadsheetId); // 404 acá si no existe
      if (full) {
        await backupAndRotate(sheets, spreadsheetId);
        await overwriteData(sheets, spreadsheetId, sheetName, rows);
      } else {
        await appendData(sheets, spreadsheetId, sheetName, rows);
      }
      return rows;
    };

    let rows: (string | number)[][];
    try {
      rows = await escribir();
    } catch (err) {
      if (!isNotFound(err)) throw err;
      // La hoja no existe → crear una nueva, guardar su ID, y hacer un full desde cero.
      spreadsheetId = await createSpreadsheet(process.env.NEXT_PUBLIC_OWNER_EMAIL);
      await syncMetaRef.set({ spreadsheetId }, { merge: true });
      full = true;
      snap = await readSnap(true);
      const sheetName = await getSheetName(sheets, spreadsheetId);
      rows = toRows(snap);
      await overwriteData(sheets, spreadsheetId, sheetName, rows); // hoja nueva ya vacía: sin backup
    }

    // El doc más nuevo sincronizado marca el corte del próximo incremental.
    const newestTs = snap.docs.length > 0
      ? (snap.docs[snap.docs.length - 1].get("timestampCarga") as Timestamp)
      : lastSyncedTs ?? null;
    await syncMetaRef.set({
      lastSync: Timestamp.now(),
      lastError: null,
      ...(newestTs ? { lastSyncedTs: newestTs } : {}),
      ...(full ? { needsFullSync: false } : {}),
    }, { merge: true });
    return { synced: rows.length, mode: full ? "full" : "incremental" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await syncMetaRef.set({ lastError: { message, at: Timestamp.now() } }, { merge: true });
    } catch { /* ignore */ }
    throw err instanceof Error ? err : new Error(message);
  }
}
