import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { ahoraAR } from "@/utils/fecha-ar";

// ID de la hoja del env como FALLBACK. El ID vigente vive en Firestore
// (syncMeta.spreadsheetId): si la hoja se borra, el sync crea una nueva y guarda su ID ahí.
const SPREADSHEET_ID_ENV = process.env.GOOGLE_SPREADSHEET_ID ?? "";
const SHEET_TITLE = "Movimientos";
const BACKUP_PREFIX = "_bak ";
const MAX_BACKUPS = 5;
// Header de la hoja (fila 1). A:I, igual que el rango que limpia/escribe overwriteData.
const HEADER = ["Fecha", "Tipo", "Categoría", "Descripción", "Monto", "Medio de pago", "Observaciones", "Período", "ID"];

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  const filePath = path.join(process.cwd(), "google-sheets-credentials.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function googleAuth() {
  return new google.auth.GoogleAuth({
    credentials: getCredentials(),
    // Drive scope además de Sheets: para compartir el archivo creado con el owner.
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  });
}

export async function getSheetsClient() {
  return google.sheets({ version: "v4", auth: googleAuth() });
}

type SheetsClient = Awaited<ReturnType<typeof getSheetsClient>>;

// Un error 404 de la API de Sheets/Drive = el archivo no existe (fue borrado o el ID es malo).
export function isNotFound(err: unknown): boolean {
  const e = err as { code?: number; status?: number; response?: { status?: number } };
  return e?.code === 404 || e?.status === 404 || e?.response?.status === 404;
}

// Crea un spreadsheet nuevo con la hoja "Movimientos" + header, y lo comparte con `ownerEmail`
// (si se pasa) para que el dueño lo vea en su Drive. Devuelve el ID nuevo. Se usa cuando el
// sheet configurado ya no existe (auto-recuperación).
export async function createSpreadsheet(ownerEmail?: string): Promise<string> {
  const auth = googleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "FinMoves — Movimientos" },
      sheets: [{ properties: { title: SHEET_TITLE } }],
    },
  });
  const id = created.data.spreadsheetId!;
  // Header en la fila 1.
  await sheets.spreadsheets.values.update({
    spreadsheetId: id, range: `'${SHEET_TITLE}'!A1`, valueInputOption: "RAW",
    requestBody: { values: [HEADER] },
  });
  // Compartir con el owner (best-effort: si falla, el archivo igual existe y funciona).
  if (ownerEmail) {
    try {
      const drive = google.drive({ version: "v3", auth });
      await drive.permissions.create({
        fileId: id, sendNotificationEmail: false,
        requestBody: { type: "user", role: "writer", emailAddress: ownerEmail },
      });
    } catch { /* el owner lo puede compartir a mano si hace falta */ }
  }
  return id;
}

// La pestaña de datos por TÍTULO (no por GID: los sheets nuevos no tienen ese GID fijo).
// Un spreadsheets.get también confirma que el archivo existe (404 si fue borrado → recrear).
export async function getSheetName(sheets: SheetsClient, spreadsheetId: string): Promise<string> {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === SHEET_TITLE)
    ?? res.data.sheets?.[0]; // fallback: la primera pestaña
  return sheet?.properties?.title ?? SHEET_TITLE;
}

// Nombre de backup ordenable cronológicamente: "_bak 2026-06-06 14-30-00" (hora AR)
function backupName(): string {
  const ar = ahoraAR();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${BACKUP_PREFIX}${ar.getUTCFullYear()}-${p(ar.getUTCMonth() + 1)}-${p(ar.getUTCDate())} ${p(ar.getUTCHours())}-${p(ar.getUTCMinutes())}-${p(ar.getUTCSeconds())}`;
}

// Duplica la hoja de datos como pestaña de backup y borra las que excedan MAX_BACKUPS.
// Debe correr ANTES de reescribir; si falla, no se debe espejar.
export async function backupAndRotate(sheets: SheetsClient, spreadsheetId: string): Promise<string> {
  const name = backupName();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const allSheets = meta.data.sheets ?? [];
  // El GID de la pestaña de datos se resuelve por título (robusto a sheets recreados).
  const dataSheet = allSheets.find((s) => s.properties?.title === SHEET_TITLE) ?? allSheets[0];
  const sourceSheetId = dataSheet?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ duplicateSheet: { sourceSheetId, newSheetName: name, insertSheetIndex: allSheets.length } }],
    },
  });

  const baksPrevios = allSheets
    .map((s) => s.properties!)
    .filter((p) => p.title?.startsWith(BACKUP_PREFIX))
    .sort((a, b) => a.title!.localeCompare(b.title!)); // viejo → nuevo

  const exceso = baksPrevios.length + 1 - MAX_BACKUPS;
  if (exceso > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: baksPrevios.slice(0, exceso).map((p) => ({ deleteSheet: { sheetId: p.sheetId } })),
      },
    });
  }
  return name;
}

// Incremental: agrega filas nuevas al final sin tocar las existentes
export async function appendData(
  sheets: SheetsClient,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][]
): Promise<void> {
  if (rows.length === 0) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A2`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

// Espejo: reemplaza TODOS los datos (desde la fila 2, preserva el header)
// con las filas dadas. Refleja altas, ediciones y borrados de la app.
export async function overwriteData(
  sheets: SheetsClient,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][]
): Promise<void> {
  // 1) Borrar datos viejos (fila 2 en adelante), dejando el encabezado.
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetName}'!A2:I`,
  });
  // 2) Escribir el set completo actual.
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }
}

// ID del spreadsheet configurado en el ENV (fallback inicial). El vigente puede haber sido
// reemplazado y vivir en Firestore (syncMeta.spreadsheetId) — eso lo resuelve sync-sheets.
export const ENV_SPREADSHEET_ID = SPREADSHEET_ID_ENV;
