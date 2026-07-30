import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fake from "../helpers/firestore-fake";
import { resetActiveFake, getActiveFake } from "../helpers/firestore-fake";

vi.mock("firebase/firestore", () => fake);
vi.mock("@/services/firebase/firebase", () => ({ db: {} }));

const UID = "uid-test";

describe("services/firebase/recurrentes", () => {
  beforeEach(() => {
    resetActiveFake();
    vi.resetModules();
  });

  it("upsertRecurrente crea el doc con id determinístico derivado de tipo+categoria+descripcion+observaciones", async () => {
    const { upsertRecurrente } = await import("@/services/firebase/recurrentes");
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Comida", descripcion: "Delivery", monto: 500 });

    const db = getActiveFake();
    const docs = db.getCollection(`users/${UID}/recurrentes`);
    expect(docs).toHaveLength(1);
    expect(docs[0].data.categoria).toBe("Comida");
    expect(docs[0].data.activo).toBe(true);
  });

  it("upsertRecurrente es idempotente: marcar el mismo recurrente dos veces no duplica el doc", async () => {
    const { upsertRecurrente } = await import("@/services/firebase/recurrentes");
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Comida", descripcion: "Delivery", monto: 500 });
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Comida", descripcion: "Delivery", monto: 600 });

    const docs = getActiveFake().getCollection(`users/${UID}/recurrentes`);
    expect(docs).toHaveLength(1);
    expect(docs[0].data.monto).toBe(600); // el merge pisa el monto con el último valor
  });

  it("observaciones distintas generan recurrentes DISTINTOS (misma descripción, otra clave)", async () => {
    const { upsertRecurrente } = await import("@/services/firebase/recurrentes");
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Games", descripcion: "Steam", observaciones: "ESO+", monto: 10 });
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Games", descripcion: "Steam", observaciones: "ESO Pass", monto: 15 });

    expect(getActiveFake().getCollection(`users/${UID}/recurrentes`)).toHaveLength(2);
  });

  it("setRecurrenteActivo desactiva sin tocar el resto de los campos", async () => {
    const { upsertRecurrente, setRecurrenteActivo, listarRecurrentes } = await import("@/services/firebase/recurrentes");
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Comida", descripcion: "Delivery", monto: 500 });
    const [r] = await listarRecurrentes(UID);

    await setRecurrenteActivo(UID, r.id, false);

    const [actualizado] = await listarRecurrentes(UID);
    expect(actualizado.activo).toBe(false);
    expect(actualizado.monto).toBe(500); // no se pierde con el merge
  });

  it("eliminarRecurrente borra el doc", async () => {
    const { upsertRecurrente, eliminarRecurrente, listarRecurrentes } = await import("@/services/firebase/recurrentes");
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Comida", descripcion: "Delivery", monto: 500 });
    const [r] = await listarRecurrentes(UID);

    await eliminarRecurrente(UID, r.id);

    expect(await listarRecurrentes(UID)).toHaveLength(0);
  });

  it("listarRecurrentes ordena por descripción", async () => {
    const { upsertRecurrente, listarRecurrentes } = await import("@/services/firebase/recurrentes");
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Comida", descripcion: "Zapatillas", monto: 1 });
    await upsertRecurrente(UID, { tipo: "Gasto", categoria: "Comida", descripcion: "Alquiler", monto: 2 });

    const lista = await listarRecurrentes(UID);
    expect(lista.map((r) => r.descripcion)).toEqual(["Alquiler", "Zapatillas"]);
  });
});
