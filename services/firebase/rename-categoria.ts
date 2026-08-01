import { collection, doc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { trackWrite } from "@/lib/sync-status";
import { recategorizarMovimientos } from "./movimientos";
import { recurrentDocId } from "@/utils/recurrent-key";
import { renombrarTemplate, quitarDeTemplate } from "@/utils/rename-categoria";
import { visualDeCategoria } from "@/utils/categoria-visual";
import type { ConfigUsuario } from "@/types";

// Renombra una categoría migrando TODO lo que la referencia por nombre, así el historial no se
// parte (ver utils/rename-categoria para el porqué). Toca, en orden:
//   1. movimientos con esa categoría → recategorizarMovimientos (batch existente, sube revisión)
//   2. config: el array `categorias` (nombre + visual fijado) y la key del `presupuestoTemplate`
//   3. recurrentes con esa categoría → su doc id deriva del nombre (recurrentKey), así que hay
//      que RE-CREAR el doc con id nuevo y borrar el viejo (no alcanza un update de campo).
//
// IMPORTANTE: los movimientos y recurrentes a migrar se LEEN DEL SERVIDOR acá, no se reciben
// del cliente. Antes se pasaba el snapshot del componente y, si el cache de movimientos todavía
// no había cargado (cache frío, o entrar directo a Ajustes), llegaba vacío → la migración se
// saltaba (ids.length === 0) y solo se renombraba config: los movimientos viejos quedaban
// colgados en la categoría anterior. Leer del servidor lo hace independiente del estado de la UI.

export async function renombrarCategoria(
  uid: string,
  actual: string,
  nuevoRaw: string,
  config: ConfigUsuario,
): Promise<void> {
  const nuevo = nuevoRaw.trim();

  // 1. Movimientos con esa categoría — query directa al servidor (no el cache del cliente).
  const movsSnap = await getDocs(query(
    collection(db, `users/${uid}/movimientos`),
    where("categoria", "==", actual),
  ));
  const ids = movsSnap.docs.map((d) => d.id);
  if (ids.length > 0) await recategorizarMovimientos(uid, ids, nuevo);

  // 2. Config: categorías + presupuesto. Se FIJA el ícono/color al valor que se venía mostrando:
  //    si la categoría no tenía visual guardado, se deducía del NOMBRE, y al cambiar el nombre
  //    la deducción daría otro ícono ("apareció uno inventado"). Guardarlo lo congela.
  const categorias = config.categorias.map((c) => {
    if (c.nombre !== actual) return c;
    const { icono, color } = visualDeCategoria(c);
    return { ...c, nombre: nuevo, icono, color };
  });
  const nuevoTemplate = renombrarTemplate(config.meta.presupuestoTemplate, actual, nuevo);
  const patch: Record<string, unknown> = { categorias };
  if (nuevoTemplate) patch["meta.presupuestoTemplate"] = nuevoTemplate;
  await trackWrite(updateDoc(doc(db, `users/${uid}/config/meta`), patch));

  // 3. Recurrentes: re-crear con doc id nuevo, borrar el viejo. El id sale del nombre de la
  //    categoría, así que un update de campo dejaría el doc en la ruta vieja y el matcheo roto.
  const recSnap = await getDocs(collection(db, `users/${uid}/recurrentes`));
  const afectados = recSnap.docs
    .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    .filter((r) => r.data.categoria === actual);
  if (afectados.length > 0) {
    const batch = writeBatch(db);
    for (const { id: viejoId, data } of afectados) {
      const nuevoId = recurrentDocId({
        tipo: data.tipo as string,
        categoria: nuevo,
        descripcion: data.descripcion as string,
        observaciones: data.observaciones as string | undefined,
      });
      batch.set(doc(db, `users/${uid}/recurrentes/${nuevoId}`), { ...data, categoria: nuevo });
      if (nuevoId !== viejoId) batch.delete(doc(db, `users/${uid}/recurrentes/${viejoId}`));
    }
    await trackWrite(batch.commit());
  }
}

// Borra una categoría de config, migrando lo que la referencia por nombre — a diferencia del
// rename, los MOVIMIENTOS existentes no se tocan (son historial real; no hay categoría nueva
// a la cual migrarlos). Toca, en orden:
//   1. config: se saca del array `categorias` y se limpia la key del `presupuestoTemplate`
//      (si no se limpia, la categoría borrada sigue apareciendo en el editor de presupuesto —
//      bug real que dejaba "Games" visible ahí después de borrarla).
//   2. recurrentes con esa categoría → se DESACTIVAN (no se borran, conservan el historial de
//      qué se cargaba), así el cron deja de recordarlos y ya no aparecen como sugerencia activa.
//
// Igual que renombrarCategoria, los recurrentes se leen del SERVIDOR, no del cliente.
export async function eliminarCategoria(
  uid: string,
  nombre: string,
  config: ConfigUsuario,
): Promise<void> {
  const categorias = config.categorias.filter((c) => c.nombre !== nombre);
  const nuevoTemplate = quitarDeTemplate(config.meta.presupuestoTemplate, nombre);
  const patch: Record<string, unknown> = { categorias };
  if (nuevoTemplate) patch["meta.presupuestoTemplate"] = nuevoTemplate;
  await trackWrite(updateDoc(doc(db, `users/${uid}/config/meta`), patch));

  const recSnap = await getDocs(collection(db, `users/${uid}/recurrentes`));
  const afectados = recSnap.docs.filter((d) => d.data().categoria === nombre && d.data().activo);
  if (afectados.length > 0) {
    const batch = writeBatch(db);
    for (const d of afectados) batch.update(d.ref, { activo: false });
    await trackWrite(batch.commit());
  }
}
