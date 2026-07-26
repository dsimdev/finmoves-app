import { describe, it, expect } from "vitest";
import { validarRename, movimientosAMigrar, renombrarTemplate } from "@/utils/rename-categoria";

describe("validarRename", () => {
  const cats = ["Comida", "Transporte", "Ocio"];

  it("acepta un nombre nuevo distinto y sin choque", () => {
    expect(validarRename("Comida", "Súper", cats)).toEqual({ ok: true });
  });

  it("rechaza vacío o solo espacios", () => {
    expect(validarRename("Comida", "", cats)).toEqual({ ok: false, motivo: "vacio" });
    expect(validarRename("Comida", "   ", cats)).toEqual({ ok: false, motivo: "vacio" });
  });

  it("rechaza el mismo nombre (sin cambio)", () => {
    expect(validarRename("Comida", "Comida", cats)).toEqual({ ok: false, motivo: "sin-cambio" });
  });

  it("rechaza chocar con otra categoría, sin importar mayúsculas", () => {
    expect(validarRename("Comida", "Ocio", cats)).toEqual({ ok: false, motivo: "duplicado" });
    expect(validarRename("Comida", "TRANSPORTE", cats)).toEqual({ ok: false, motivo: "duplicado" });
  });

  it("permite recapitalizar la PROPIA categoría (no es choque consigo misma)", () => {
    // "Comida" → "comida": no choca con las OTRAS, así que es un rename válido.
    expect(validarRename("Comida", "comida", cats)).toEqual({ ok: true });
  });

  it("hace trim antes de comparar sin-cambio", () => {
    expect(validarRename("Comida", "  Comida  ", cats)).toEqual({ ok: false, motivo: "sin-cambio" });
  });
});

describe("movimientosAMigrar", () => {
  const movs = [
    { id: "1", categoria: "Comida" },
    { id: "2", categoria: "Ocio" },
    { id: "3", categoria: "Comida" },
    { id: "4", categoria: "comida" }, // distinta capitalización = otra categoría, NO migra
  ];

  it("devuelve solo los ids con la categoría exacta", () => {
    expect(movimientosAMigrar(movs, "Comida")).toEqual(["1", "3"]);
  });

  it("no migra por coincidencia case-insensitive", () => {
    expect(movimientosAMigrar(movs, "Comida")).not.toContain("4");
  });

  it("lista vacía si ninguno matchea", () => {
    expect(movimientosAMigrar(movs, "Salud")).toEqual([]);
  });
});

describe("renombrarTemplate", () => {
  it("mueve el monto a la nueva key y borra la vieja", () => {
    const tpl = { Comida: 50000, Ocio: 20000 };
    expect(renombrarTemplate(tpl, "Comida", "Súper")).toEqual({ "Súper": 50000, Ocio: 20000 });
  });

  it("hace trim de la nueva key", () => {
    expect(renombrarTemplate({ Comida: 50000 }, "Comida", "  Súper  ")).toEqual({ "Súper": 50000 });
  });

  it("devuelve null si esa categoría no tenía presupuesto (nada que migrar)", () => {
    expect(renombrarTemplate({ Ocio: 20000 }, "Comida", "Súper")).toBeNull();
    expect(renombrarTemplate(undefined, "Comida", "Súper")).toBeNull();
  });

  it("no muta el template original", () => {
    const tpl = { Comida: 50000 };
    renombrarTemplate(tpl, "Comida", "Súper");
    expect(tpl).toEqual({ Comida: 50000 });
  });
});
