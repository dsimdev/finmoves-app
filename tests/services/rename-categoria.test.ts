import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fake from "../helpers/firestore-fake";
import { resetActiveFake, getActiveFake } from "../helpers/firestore-fake";
import type { ConfigUsuario, Categoria } from "@/types";
import { recurrentDocId } from "@/utils/recurrent-key";

// El servicio real hace `import { db } from "./firebase"`; ambos mocks apuntan a las
// mismas rutas relativas que ve services/firebase/rename-categoria.ts.
vi.mock("firebase/firestore", () => fake);
vi.mock("@/services/firebase/firebase", () => ({ db: {} }));

const UID = "uid-test";

function configConCategoria(nombre: string, extra?: Partial<Categoria>): ConfigUsuario {
  return {
    categorias: [{ id: "c1", nombre, tipo: "Gasto", activa: true, ...extra }],
    mediosPago: [],
    tipos: [],
    origenesAhorro: [],
    meta: { usdMensual: 0, tipoCambioRef: "oficial", presupuestoTemplate: { [nombre]: 5000 } },
  };
}

describe("renombrarCategoria", () => {
  beforeEach(() => {
    const db = resetActiveFake();
    // config/meta siempre existe en la app real antes de poder renombrar una categoría
    // (se crea al login); updateDoc sobre un doc inexistente es un error real de Firestore.
    db.setDoc(`users/${UID}/config/meta`, {});
    vi.resetModules();
  });

  it("migra movimientos leídos del SERVIDOR aunque el cliente no reciba nada por parámetro (bug real v2.104.0)", async () => {
    const db = getActiveFake();
    // Movimientos preexistentes en "Firestore", nunca pasados a la función — simula el
    // cache frío del cliente que causó el bug: la migración debe encontrar los movimientos
    // por su cuenta, consultando el servidor, no depender de que el caller se los pase.
    db.setDoc(`users/${UID}/movimientos/m1`, { categoria: "Comida", monto: 100 });
    db.setDoc(`users/${UID}/movimientos/m2`, { categoria: "Comida", monto: 200 });
    db.setDoc(`users/${UID}/movimientos/m3`, { categoria: "Otros", monto: 50 }); // no debe tocarse

    const { renombrarCategoria } = await import("@/services/firebase/rename-categoria");
    await renombrarCategoria(UID, "Comida", "Alimentos", configConCategoria("Comida"));

    expect(db.getDoc(`users/${UID}/movimientos/m1`)?.categoria).toBe("Alimentos");
    expect(db.getDoc(`users/${UID}/movimientos/m2`)?.categoria).toBe("Alimentos");
    expect(db.getDoc(`users/${UID}/movimientos/m3`)?.categoria).toBe("Otros");
  });

  it("congela el ícono/color de la categoría en vez de dejar que se re-derive del nombre nuevo", async () => {
    const { renombrarCategoria } = await import("@/services/firebase/rename-categoria");
    const config = configConCategoria("Comida"); // sin icono/color propio: hoy se deduce del nombre
    await renombrarCategoria(UID, "Comida", "Alimentos", config);

    const meta = getActiveFake().getDoc(`users/${UID}/config/meta`);
    const categorias = meta?.categorias as Categoria[];
    const migrada = categorias.find((c) => c.nombre === "Alimentos");
    expect(migrada).toBeDefined();
    expect(migrada?.icono).toBeDefined();
    expect(migrada?.color).toBeDefined();
  });

  it("renombra la key del presupuestoTemplate junto con la categoría", async () => {
    const { renombrarCategoria } = await import("@/services/firebase/rename-categoria");
    await renombrarCategoria(UID, "Comida", "Alimentos", configConCategoria("Comida"));

    const meta = getActiveFake().getDoc(`users/${UID}/config/meta`);
    const nested = meta?.meta as { presupuestoTemplate?: Record<string, number> } | undefined;
    expect(nested?.presupuestoTemplate).toEqual({ Alimentos: 5000 });
  });

  it("no toca movimientos ni dispara ninguna escritura de lote si no hay ninguno con esa categoría", async () => {
    const { renombrarCategoria } = await import("@/services/firebase/rename-categoria");
    const db = getActiveFake();
    db.setDoc(`users/${UID}/movimientos/m1`, { categoria: "Otros", monto: 50 });

    await renombrarCategoria(UID, "Comida", "Alimentos", configConCategoria("Comida"));

    expect(db.getDoc(`users/${UID}/movimientos/m1`)?.categoria).toBe("Otros");
  });

  it("re-crea el recurrente con id nuevo derivado del nombre y borra el viejo", async () => {
    const db = getActiveFake();
    const viejoId = recurrentDocId({ tipo: "Gasto", categoria: "Comida", descripcion: "", observaciones: "" });
    db.setDoc(`users/${UID}/recurrentes/${viejoId}`, {
      tipo: "Gasto", categoria: "Comida", descripcion: "", observaciones: "", monto: 100, activo: true,
    });

    const { renombrarCategoria } = await import("@/services/firebase/rename-categoria");
    await renombrarCategoria(UID, "Comida", "Alimentos", configConCategoria("Comida"));

    expect(db.getDoc(`users/${UID}/recurrentes/${viejoId}`)).toBeUndefined();
    const nuevoId = recurrentDocId({ tipo: "Gasto", categoria: "Alimentos", descripcion: "", observaciones: "" });
    const nuevo = db.getDoc(`users/${UID}/recurrentes/${nuevoId}`);
    expect(nuevo?.categoria).toBe("Alimentos");
    expect(nuevo?.monto).toBe(100);
  });

  it("recurrentes de otra categoría quedan intactos", async () => {
    const db = getActiveFake();
    db.setDoc(`users/${UID}/recurrentes/otro-id`, { tipo: "Gasto", categoria: "Transporte", descripcion: "", monto: 10, activo: true });

    const { renombrarCategoria } = await import("@/services/firebase/rename-categoria");
    await renombrarCategoria(UID, "Comida", "Alimentos", configConCategoria("Comida"));

    expect(db.getDoc(`users/${UID}/recurrentes/otro-id`)?.categoria).toBe("Transporte");
  });
});
