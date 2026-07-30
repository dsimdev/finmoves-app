import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fake from "../helpers/firestore-fake";
import { resetActiveFake, getActiveFake } from "../helpers/firestore-fake";

vi.mock("firebase/firestore", () => fake);
vi.mock("@/services/firebase/firebase", () => ({ db: {} }));

const UID = "uid-test";

describe("services/firebase/config", () => {
  beforeEach(() => {
    resetActiveFake();
    vi.resetModules();
  });

  it("obtenerConfig crea la config default si el doc no existe todavía", async () => {
    const { obtenerConfig } = await import("@/services/firebase/config");
    const config = await obtenerConfig(UID);

    expect(config.categorias.length).toBeGreaterThan(0);
    expect(config.meta.tipoCambioRef).toBe("oficial");
    // Se persiste, no solo se devuelve en memoria.
    expect(getActiveFake().getDoc(`users/${UID}/config/meta`)).toBeDefined();
  });

  it("obtenerConfig inyecta los permisos desde el doc separado config/permisos, sobrescribiendo lo local", async () => {
    const db = resetActiveFake();
    db.setDoc(`users/${UID}/config/meta`, {
      categorias: [], mediosPago: [], tipos: [], origenesAhorro: [],
      meta: { usdMensual: 0, tipoCambioRef: "oficial", permisos: { comprobantes: true } }, // valor local, debe ser pisado
    });
    db.setDoc(`users/${UID}/config/permisos`, { comprobantes: false, inversion: true });

    const { obtenerConfig } = await import("@/services/firebase/config");
    const config = await obtenerConfig(UID);

    expect(config.meta.permisos).toEqual({ comprobantes: false, inversion: true });
  });

  it("obtenerConfig usa permisos vacíos si el doc config/permisos no existe (default OFF)", async () => {
    const db = resetActiveFake();
    db.setDoc(`users/${UID}/config/meta`, { categorias: [], mediosPago: [], tipos: [], origenesAhorro: [], meta: { usdMensual: 0, tipoCambioRef: "oficial" } });

    const { obtenerConfig } = await import("@/services/firebase/config");
    const config = await obtenerConfig(UID);

    expect(config.meta.permisos).toEqual({});
  });

  it("obtenerConfig migra metaMonto/metaFecha/metaMoneda viejos a metaFX en memoria (no persiste solo)", async () => {
    const db = resetActiveFake();
    db.setDoc(`users/${UID}/config/meta`, {
      categorias: [], mediosPago: [], tipos: [], origenesAhorro: [],
      meta: { usdMensual: 0, tipoCambioRef: "oficial", metaMonto: 1000, metaFecha: "2026-12-31", metaMoneda: "USD" },
    });

    const { obtenerConfig } = await import("@/services/firebase/config");
    const config = await obtenerConfig(UID);

    expect(config.meta.metaFX).toEqual({ monto: 1000, fecha: "2026-12-31", moneda: "USD" });
    // La migración es solo en memoria: el doc en Firestore sigue sin metaFX hasta que el usuario guarde.
    expect((db.getDoc(`users/${UID}/config/meta`)?.meta as Record<string, unknown>)?.metaFX).toBeUndefined();
  });

  it("obtenerConfig NO pisa un metaFX que ya existe con la migración vieja", async () => {
    const db = resetActiveFake();
    db.setDoc(`users/${UID}/config/meta`, {
      categorias: [], mediosPago: [], tipos: [], origenesAhorro: [],
      meta: { usdMensual: 0, tipoCambioRef: "oficial", metaMonto: 1000, metaFX: { monto: 500, moneda: "EUR" } },
    });

    const { obtenerConfig } = await import("@/services/firebase/config");
    const config = await obtenerConfig(UID);

    expect(config.meta.metaFX).toEqual({ monto: 500, moneda: "EUR" });
  });

  it("ensureUserDoc crea users/{uid} solo si no existe", async () => {
    const { ensureUserDoc } = await import("@/services/firebase/config");
    await ensureUserDoc(UID);

    const db = getActiveFake();
    expect(db.getDoc(`users/${UID}`)).toBeDefined();
  });

  it("ensureUserDoc no rompe si el doc users/{uid} ya existe", async () => {
    const db = resetActiveFake();
    db.setDoc(`users/${UID}`, { createdAt: "ya existente" });

    const { ensureUserDoc } = await import("@/services/firebase/config");
    await ensureUserDoc(UID);

    expect(db.getDoc(`users/${UID}`)?.createdAt).toBe("ya existente");
  });

  it("actualizarTipoCambio actualiza solo el campo anidado meta.tipoCambioRef", async () => {
    const db = resetActiveFake();
    db.setDoc(`users/${UID}/config/meta`, { meta: { usdMensual: 0, tipoCambioRef: "oficial" } });

    const { actualizarTipoCambio } = await import("@/services/firebase/config");
    await actualizarTipoCambio(UID, "blue");

    const meta = db.getDoc(`users/${UID}/config/meta`)?.meta as Record<string, unknown>;
    expect(meta.tipoCambioRef).toBe("blue");
    expect(meta.usdMensual).toBe(0); // el resto de meta no se pierde
  });
});
