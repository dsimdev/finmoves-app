import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fake from "../helpers/firestore-fake";
import { resetActiveFake, getActiveFake } from "../helpers/firestore-fake";
import type { Movimiento } from "@/types";

vi.mock("firebase/firestore", () => fake);
vi.mock("@/services/firebase/firebase", () => ({ db: {} }));
vi.mock("@/lib/sync-status", () => ({ trackWrite: (p: Promise<unknown>) => p }));

const UID = "uid-test";

function mov(overrides: Partial<Movimiento> = {}): Omit<Movimiento, "id"> {
  return {
    timestampCarga: new Date("2026-07-01T00:00:00Z"),
    fecha: "2026-07-01",
    tipo: "Gasto",
    categoria: "Comida",
    descripcion: "Test",
    monto: 100,
    medioPago: "Efectivo",
    observaciones: "",
    periodoId: "2026-07",
    userId: UID,
    ...overrides,
  };
}

describe("services/firebase/movimientos", () => {
  beforeEach(() => {
    const db = resetActiveFake();
    db.setDoc(`users/${UID}/config/meta`, {});
    vi.resetModules();
  });

  it("crearMovimientoConId escribe el doc con el id dado y sube movsRevision", async () => {
    const { crearMovimientoConId } = await import("@/services/firebase/movimientos");
    await crearMovimientoConId(UID, "m1", mov());

    const db = getActiveFake();
    expect(db.getDoc(`users/${UID}/movimientos/m1`)?.categoria).toBe("Comida");
    const meta = db.getDoc(`users/${UID}/config/meta`);
    expect(meta?.movsRevision).toBe(1);
  });

  it("actualizarMovimiento aplica el patch y sube la revisión de nuevo", async () => {
    const { crearMovimientoConId, actualizarMovimiento } = await import("@/services/firebase/movimientos");
    await crearMovimientoConId(UID, "m1", mov());
    await actualizarMovimiento(UID, "m1", { monto: 999 });

    const db = getActiveFake();
    expect(db.getDoc(`users/${UID}/movimientos/m1`)?.monto).toBe(999);
    expect(db.getDoc(`users/${UID}/config/meta`)?.movsRevision).toBe(2);
  });

  it("eliminarMovimiento borra el doc", async () => {
    const { crearMovimientoConId, eliminarMovimiento } = await import("@/services/firebase/movimientos");
    await crearMovimientoConId(UID, "m1", mov());
    await eliminarMovimiento(UID, "m1");

    expect(getActiveFake().getDoc(`users/${UID}/movimientos/m1`)).toBeUndefined();
  });

  it("eliminarMovimientos en lote borra todos los ids dados y no toca los demás", async () => {
    const { crearMovimientoConId, eliminarMovimientos } = await import("@/services/firebase/movimientos");
    await crearMovimientoConId(UID, "m1", mov());
    await crearMovimientoConId(UID, "m2", mov());
    await crearMovimientoConId(UID, "m3", mov());

    await eliminarMovimientos(UID, ["m1", "m2"]);

    const db = getActiveFake();
    expect(db.getDoc(`users/${UID}/movimientos/m1`)).toBeUndefined();
    expect(db.getDoc(`users/${UID}/movimientos/m2`)).toBeUndefined();
    expect(db.getDoc(`users/${UID}/movimientos/m3`)).toBeDefined();
  });

  it("eliminarMovimientos con lista vacía no escribe nada (early return)", async () => {
    const { eliminarMovimientos } = await import("@/services/firebase/movimientos");
    await eliminarMovimientos(UID, []);

    // Sin movsRevision: el early return evita el bump también.
    expect(getActiveFake().getDoc(`users/${UID}/config/meta`)?.movsRevision).toBeUndefined();
  });

  it("recategorizarMovimientos reasigna la categoría de varios movimientos de una", async () => {
    const { crearMovimientoConId, recategorizarMovimientos } = await import("@/services/firebase/movimientos");
    await crearMovimientoConId(UID, "m1", mov({ categoria: "Comida" }));
    await crearMovimientoConId(UID, "m2", mov({ categoria: "Comida" }));
    await crearMovimientoConId(UID, "m3", mov({ categoria: "Otros" }));

    await recategorizarMovimientos(UID, ["m1", "m2"], "Alimentos");

    const db = getActiveFake();
    expect(db.getDoc(`users/${UID}/movimientos/m1`)?.categoria).toBe("Alimentos");
    expect(db.getDoc(`users/${UID}/movimientos/m2`)?.categoria).toBe("Alimentos");
    expect(db.getDoc(`users/${UID}/movimientos/m3`)?.categoria).toBe("Otros");
  });

  it("restaurarMovimientos recrea los movimientos con su MISMO id (undo de borrado en lote)", async () => {
    const { restaurarMovimientos } = await import("@/services/firebase/movimientos");
    const original: Movimiento = { id: "m1", ...mov({ monto: 777 }) };

    await restaurarMovimientos(UID, [original]);

    const db = getActiveFake();
    expect(db.getDoc(`users/${UID}/movimientos/m1`)?.monto).toBe(777);
  });
});
