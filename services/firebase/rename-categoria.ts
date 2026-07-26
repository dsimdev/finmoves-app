import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { trackWrite } from "@/lib/sync-status";
import { recategorizarMovimientos } from "./movimientos";
import { recurrentDocId } from "@/utils/recurrent-key";
import { movimientosAMigrar, renombrarTemplate } from "@/utils/rename-categoria";
import type { ConfigUsuario, Movimiento } from "@/types";
import type { Recurrente } from "./recurrentes";

// Renombra una categoría migrando TODO lo que la referencia por nombre, así el historial no se
// parte (ver utils/rename-categoria para el porqué). Toca, en orden:
//   1. movimientos con esa categoría → recategorizarMovimientos (batch existente, sube revisión)
//   2. config: el array `categorias` y la key del `presupuestoTemplate`
//   3. recurrentes con esa categoría → su doc id deriva del nombre (recurrentKey), así que hay
//      que RE-CREAR el doc con id nuevo y borrar el viejo (no alcanza un update de campo).

export async function renombrarCategoria(
  uid: string,
  actual: string,
  nuevoRaw: string,
  config: ConfigUsuario,
  movimientos: Movimiento[],
  recurrentes: Recurrente[],
): Promise<void> {
  const nuevo = nuevoRaw.trim();

  // 1. Movimientos.
  const ids = movimientosAMigrar(movimientos, actual);
  if (ids.length > 0) await recategorizarMovimientos(uid, ids, nuevo);

  // 2. Config: categorías + presupuesto.
  const categorias = config.categorias.map((c) => (c.nombre === actual ? { ...c, nombre: nuevo } : c));
  const nuevoTemplate = renombrarTemplate(config.meta.presupuestoTemplate, actual, nuevo);
  const patch: Record<string, unknown> = { categorias };
  if (nuevoTemplate) patch["meta.presupuestoTemplate"] = nuevoTemplate;
  await trackWrite(updateDoc(doc(db, `users/${uid}/config/meta`), patch));

  // 3. Recurrentes: re-crear con doc id nuevo, borrar el viejo. El id sale del nombre de la
  //    categoría, así que un update de campo dejaría el doc en la ruta vieja y el matcheo roto.
  const afectados = recurrentes.filter((r) => r.categoria === actual);
  if (afectados.length > 0) {
    const batch = writeBatch(db);
    for (const r of afectados) {
      const nuevoId = recurrentDocId({ tipo: r.tipo, categoria: nuevo, descripcion: r.descripcion, observaciones: r.observaciones });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _viejo, ...datos } = r;
      batch.set(doc(db, `users/${uid}/recurrentes/${nuevoId}`), { ...datos, categoria: nuevo });
      if (nuevoId !== r.id) batch.delete(doc(db, `users/${uid}/recurrentes/${r.id}`));
    }
    await trackWrite(batch.commit());
  }
}
