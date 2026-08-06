import { describe, it, expect } from "vitest";
import { sugerirRecurrente, PERIODOS_PARA_SUGERIR } from "@/utils/recurrent-detection";
import type { Movimiento } from "@/types";

const mov = (o: Partial<Movimiento>): Movimiento => ({
  id: Math.random().toString(36).slice(2), timestampCarga: new Date(), fecha: "2026-01-01",
  tipo: "Gasto", categoria: "x", descripcion: "", monto: 0, medioPago: "—",
  observaciones: "", periodoId: "1/1/2026", userId: "u", ...o,
});

describe("sugerirRecurrente", () => {
  it(`sugiere con ${PERIODOS_PARA_SUGERIR} períodos distintos de la misma combinación`, () => {
    const movs = [
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/1/2026" }),
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/2/2026" }),
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/3/2026" }),
    ];
    expect(sugerirRecurrente(movs, { tipo: "Gasto", categoria: "Servicios", descripcion: "Netflix" }, new Set())).toBe(true);
  });

  it("NO sugiere con menos períodos que el umbral", () => {
    const movs = [
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/1/2026" }),
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/2/2026" }),
    ];
    expect(sugerirRecurrente(movs, { tipo: "Gasto", categoria: "Servicios", descripcion: "Netflix" }, new Set())).toBe(false);
  });

  it("varias cargas en el MISMO período cuentan como 1 solo período (no gasto repetido casual)", () => {
    const movs = [
      mov({ categoria: "Comida", descripcion: "Supermercado", periodoId: "1/1/2026" }),
      mov({ categoria: "Comida", descripcion: "Supermercado", periodoId: "1/1/2026" }),
      mov({ categoria: "Comida", descripcion: "Supermercado", periodoId: "1/1/2026" }),
    ];
    expect(sugerirRecurrente(movs, { tipo: "Gasto", categoria: "Comida", descripcion: "Supermercado" }, new Set())).toBe(false);
  });

  it("no exige monto igual: montos distintos en cada período igual cuentan", () => {
    const movs = [
      mov({ categoria: "Servicios", descripcion: "Gimnasio", periodoId: "1/1/2026", monto: 5000 }),
      mov({ categoria: "Servicios", descripcion: "Gimnasio", periodoId: "1/2/2026", monto: 5500 }),
      mov({ categoria: "Servicios", descripcion: "Gimnasio", periodoId: "1/3/2026", monto: 6000 }),
    ];
    expect(sugerirRecurrente(movs, { tipo: "Gasto", categoria: "Servicios", descripcion: "Gimnasio" }, new Set())).toBe(true);
  });

  it("nunca sugiere si ya es un recurrente activo", () => {
    const movs = [
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/1/2026" }),
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/2/2026" }),
      mov({ categoria: "Servicios", descripcion: "Netflix", periodoId: "1/3/2026" }),
    ];
    const activos = new Set(["Gasto__Servicios__netflix__"]);
    expect(sugerirRecurrente(movs, { tipo: "Gasto", categoria: "Servicios", descripcion: "Netflix" }, activos)).toBe(false);
  });

  it("sin descripción no sugiere (nada que agrupar)", () => {
    expect(sugerirRecurrente([], { tipo: "Gasto", categoria: "Comida", descripcion: "" }, new Set())).toBe(false);
    expect(sugerirRecurrente([], { tipo: "Gasto", categoria: "Comida" }, new Set())).toBe(false);
  });

  it("observación distinta es una combinación DISTINTA (no suma períodos)", () => {
    const movs = [
      mov({ categoria: "Servicios", descripcion: "Steam", observaciones: "ESO+", periodoId: "1/1/2026" }),
      mov({ categoria: "Servicios", descripcion: "Steam", observaciones: "ESO+", periodoId: "1/2/2026" }),
      mov({ categoria: "Servicios", descripcion: "Steam", observaciones: "ESO Pass", periodoId: "1/3/2026" }),
    ];
    expect(sugerirRecurrente(movs, { tipo: "Gasto", categoria: "Servicios", descripcion: "Steam", observaciones: "ESO+" }, new Set())).toBe(false);
  });

  it("categoría distinta no cuenta, aunque la descripción coincida", () => {
    const movs = [
      mov({ categoria: "Comida", descripcion: "Pago", periodoId: "1/1/2026" }),
      mov({ categoria: "Servicios", descripcion: "Pago", periodoId: "1/2/2026" }),
      mov({ categoria: "Ocio", descripcion: "Pago", periodoId: "1/3/2026" }),
    ];
    expect(sugerirRecurrente(movs, { tipo: "Gasto", categoria: "Comida", descripcion: "Pago" }, new Set())).toBe(false);
  });
});
