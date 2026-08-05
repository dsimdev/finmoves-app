import { describe, it, expect } from "vitest";
import { categoriasEnRiesgo, partirPorEstado, pctPresupuestoCategoria, MIN_DIAS_PARA_PROYECTAR } from "@/utils/budget-alert";

// Un período dura 30 días. Proyección = gastado / diasTranscurridos * 30.
// El umbral de disparo es 1.05× el presupuesto.

describe("categoriasEnRiesgo", () => {
  it("no proyecta antes de MIN_DIAS (pocos datos = ruido)", () => {
    // Gasto altísimo pero solo pasaron 3 días → no avisa todavía.
    const r = categoriasEnRiesgo({ Comida: 9000 }, { Comida: 10000 }, 3);
    expect(r).toEqual([]);
    expect(MIN_DIAS_PARA_PROYECTAR).toBe(9);
  });

  it("avisa cuando el ritmo proyecta pasarse del presupuesto", () => {
    // 6000 en 9 días → 666/día → *30 = 20000 proyectado vs 10000 presu (200%).
    const r = categoriasEnRiesgo({ Comida: 6000 }, { Comida: 10000 }, 9);
    expect(r).toHaveLength(1);
    expect(r[0].categoria).toBe("Comida");
    expect(r[0].pctProyectado).toBe(200);
  });

  it("NO avisa si el ritmo cierra dentro del presupuesto", () => {
    // 3000 en 15 días → 200/día → *30 = 6000 proyectado vs 10000 presu → OK.
    const r = categoriasEnRiesgo({ Comida: 3000 }, { Comida: 10000 }, 15);
    expect(r).toEqual([]);
  });

  it("NO avisa por un desvío trivial bajo el umbral 1.05", () => {
    // Proyección = 10200 vs 10000 = 1.02× → bajo 1.05, no molesta.
    // 5100 en 15 días → 340/día → *30 = 10200.
    const r = categoriasEnRiesgo({ Comida: 5100 }, { Comida: 10000 }, 15);
    expect(r).toEqual([]);
  });

  it("ignora categorías ya avisadas este período (dedup)", () => {
    const r = categoriasEnRiesgo({ Comida: 6000 }, { Comida: 10000 }, 9, ["Comida"]);
    expect(r).toEqual([]);
  });

  it("ignora categorías sin presupuesto o sin gasto", () => {
    const r = categoriasEnRiesgo(
      { Comida: 6000, Ocio: 0 },
      { Comida: 10000, Ocio: 5000, Transporte: 0 },
      9
    );
    // Comida sí (proyecta pasarse); Ocio no (sin gasto); Transporte no (presu 0).
    expect(r.map((c) => c.categoria)).toEqual(["Comida"]);
  });

  it("ordena de peor a mejor por % proyectado", () => {
    const r = categoriasEnRiesgo(
      { Comida: 6000, Ocio: 4500 },
      { Comida: 10000, Ocio: 10000 },
      9
    );
    // Comida 200%, Ocio 150% → Comida primero.
    expect(r.map((c) => c.categoria)).toEqual(["Comida", "Ocio"]);
    expect(r[0].pctProyectado).toBeGreaterThan(r[1].pctProyectado);
  });

  it("detecta una categoría YA excedida aunque el ritmo se haya amesetado", () => {
    // Gastó 12.000 de 10.000 en 25 días: el ritmo proyecta 14.400, pero lo importante es que
    // YA se pasó. Antes esto podía no entrar si la proyección quedaba baja.
    const r = categoriasEnRiesgo({ Comida: 12000 }, { Comida: 10000 }, 25);
    expect(r).toHaveLength(1);
    expect(r[0].excedida).toBe(true);
    expect(r[0].pctGastado).toBe(120);
  });

  it("una categoría excedida entra aunque su proyección no supere el umbral", () => {
    // Gastó 10.500 de 10.000 el último día del período: proyección ≈ presupuesto (no dispara
    // por ritmo), pero ya se pasó.
    const r = categoriasEnRiesgo({ Comida: 10500 }, { Comida: 10000 }, 30);
    expect(r).toHaveLength(1);
    expect(r[0].excedida).toBe(true);
  });

  it("distingue excedida de en-riesgo", () => {
    // Comida ya se pasó (12.000 > 10.000); Ocio todavía no (4.000 < 10.000) pero proyecta 12.000.
    const r = categoriasEnRiesgo({ Comida: 12000, Ocio: 4000 }, { Comida: 10000, Ocio: 10000 }, 10);
    const { excedidas, enRiesgo } = partirPorEstado(r);
    expect(excedidas.map((c) => c.categoria)).toEqual(["Comida"]);
    expect(enRiesgo.map((c) => c.categoria)).toEqual(["Ocio"]);
  });

  it("las excedidas se ordenan por cuánto se pasaron", () => {
    const r = categoriasEnRiesgo(
      { A: 11000, B: 20000, C: 15000 },
      { A: 10000, B: 10000, C: 10000 },
      15
    );
    const { excedidas } = partirPorEstado(r);
    expect(excedidas.map((c) => c.categoria)).toEqual(["B", "C", "A"]); // 200%, 150%, 110%
  });

  // Simula el ciclo de vida del dedup por período tal como lo maneja checkPresupuesto.
  it("ciclo de vida: avisa una vez, calla el resto del período, resetea en el nuevo", () => {
    const presu = { Comida: 10000 };
    // Día 5: pocos datos, no avisa aunque el gasto sea alto.
    expect(categoriasEnRiesgo({ Comida: 8000 }, presu, 5, [])).toHaveLength(0);
    // Día 10: proyecta pasarse → avisa (aún no está en la lista de avisadas).
    expect(categoriasEnRiesgo({ Comida: 6000 }, presu, 10, [])).toHaveLength(1);
    // Día 12: ya se avisó por Comida este período → no repite.
    expect(categoriasEnRiesgo({ Comida: 7000 }, presu, 12, ["Comida"])).toHaveLength(0);
    // Período nuevo (dedup vacío) → vuelve a poder avisar.
    expect(categoriasEnRiesgo({ Comida: 6000 }, presu, 10, [])).toHaveLength(1);
  });
});

describe("pctPresupuestoCategoria", () => {
  it("suma el monto en curso al gastado antes de calcular el %", () => {
    // 8000 ya gastado + 500 en curso = 8500 de 10000 → 85%.
    expect(pctPresupuestoCategoria("Comida", { Comida: 8000 }, { Comida: 10000 }, 500)).toBe(85);
  });

  it("devuelve el % aunque no haya gasto previo (categoría nueva este período)", () => {
    expect(pctPresupuestoCategoria("Comida", {}, { Comida: 10000 }, 3000)).toBe(30);
  });

  it("puede superar 100 (categoría ya excedida)", () => {
    expect(pctPresupuestoCategoria("Comida", { Comida: 9500 }, { Comida: 10000 }, 1000)).toBe(105);
  });

  it("null si la categoría no tiene presupuesto puesto", () => {
    expect(pctPresupuestoCategoria("Ocio", { Ocio: 1000 }, { Comida: 10000 }, 500)).toBeNull();
  });

  it("null si el presupuesto de la categoría es 0", () => {
    expect(pctPresupuestoCategoria("Comida", {}, { Comida: 0 }, 500)).toBeNull();
  });

  it("ignora un monto en curso negativo (no debería pasar, pero no debe restar)", () => {
    expect(pctPresupuestoCategoria("Comida", { Comida: 8000 }, { Comida: 10000 }, -500)).toBe(80);
  });
});
