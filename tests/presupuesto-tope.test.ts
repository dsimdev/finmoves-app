import { describe, it, expect } from "vitest";
import { balancePresupuesto, topeCategoria } from "@/utils/presupuesto-tope";

describe("balancePresupuesto", () => {
  it("suma lo distribuido y calcula el restante", () => {
    const b = balancePresupuesto({ Comida: 30000, Transporte: 20000 }, 100000);
    expect(b.distribuido).toBe(50000);
    expect(b.restante).toBe(50000);
    expect(b.excede).toBe(false);
    expect(b.excedente).toBe(0);
    expect(b.fraccion).toBeCloseTo(0.5);
  });

  it("marca excede y el excedente cuando pasa el sueldo", () => {
    const b = balancePresupuesto({ Comida: 80000, Ocio: 40000 }, 100000);
    expect(b.distribuido).toBe(120000);
    expect(b.restante).toBe(-20000);
    expect(b.excede).toBe(true);
    expect(b.excedente).toBe(20000);
    expect(b.fraccion).toBeCloseTo(1.2);
  });

  it("distribuir EXACTO el sueldo no excede", () => {
    const b = balancePresupuesto({ A: 60000, B: 40000 }, 100000);
    expect(b.restante).toBe(0);
    expect(b.excede).toBe(false);
  });

  it("ignora montos ≤ 0 o inválidos", () => {
    const b = balancePresupuesto({ A: 50000, B: 0, C: -10 }, 100000);
    expect(b.distribuido).toBe(50000);
  });

  it("sin sueldo (0) no hay referencia: fraccion 0, no excede", () => {
    const b = balancePresupuesto({ A: 50000 }, 0);
    expect(b.sueldo).toBe(0);
    expect(b.fraccion).toBe(0);
    expect(b.excede).toBe(false);
    expect(b.excedente).toBe(0);
    expect(b.restante).toBe(-50000); // 0 - 50000: informativo, pero excede es false sin ref
  });

  it("sueldo negativo se trata como sin referencia", () => {
    const b = balancePresupuesto({ A: 10000 }, -5000);
    expect(b.sueldo).toBe(0);
    expect(b.excede).toBe(false);
  });
});

describe("topeCategoria", () => {
  it("deja tomar todo lo que no ocupan las OTRAS categorías", () => {
    // sueldo 100k, otras (Comida) ocupan 30k → Ocio puede llegar a 70k
    // (los 25k que ya tenía Ocio no cuentan contra sí misma).
    expect(topeCategoria({ Comida: 30000, Ocio: 25000 }, "Ocio", 100000)).toBe(70000);
  });

  it("con el resto ya en el tope, la categoría solo puede quedar en 0", () => {
    expect(topeCategoria({ A: 100000, B: 0 }, "B", 100000)).toBe(0);
  });

  it("si las otras ya exceden, el tope es 0 (no negativo)", () => {
    expect(topeCategoria({ A: 120000 }, "B", 100000)).toBe(0);
  });

  it("sin sueldo de referencia no topea (Infinity)", () => {
    expect(topeCategoria({ A: 50000 }, "A", 0)).toBe(Infinity);
  });

  it("la categoría editada no se cuenta contra sí misma", () => {
    // Solo A presupuestada: puede llegar al sueldo completo.
    expect(topeCategoria({ A: 40000 }, "A", 100000)).toBe(100000);
  });
});
