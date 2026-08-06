import { describe, it, expect } from "vitest";
import { parsePeriodoId, estadisticasPeriodos, ritmoGasto, serieTendencia, inflacionPersonal, variacionGastoVsAnterior, progresoMetaPropia, ritmoAhorro, kpisPeriodo, periodosHastaFecha, ritmoNecesarioParaFecha } from "@/utils/reportes";
import { agruparPorPeriodo } from "@/utils/periodo";
import type { PeriodoResumen } from "@/utils/periodo";
import type { Movimiento } from "@/types";

// Movimiento mínimo para armar series; se sobreescribe lo que cada caso necesita.
const mov = (o: Partial<Movimiento>): Movimiento => ({
  id: Math.random().toString(36).slice(2), timestampCarga: new Date(), fecha: "2026-01-01",
  tipo: "Gasto", categoria: "x", descripcion: "", monto: 0, medioPago: "—",
  observaciones: "", periodoId: "1/1/2026", userId: "u", ...o,
});

function periodo(p: Partial<PeriodoResumen>): PeriodoResumen {
  return {
    periodoId: "1/1/2026", sueldo: 0, extras: 0, total: 0, gastado: 0, gastadoPuro: 0,
    ahorros: 0, resto: 0, disponible: 0, moveDisponible: 0, moveAhorros: 0, pct: 0,
    movimientos: [], ...p,
  };
}

// Movimientos de Gasto para armar el gasto puro de un período (inflación personal).
function gastos(...montos: number[]): Movimiento[] {
  return montos.map((monto) => ({ tipo: "Gasto", monto } as Movimiento));
}

describe("parsePeriodoId", () => {
  it("parsea D/M/YYYY a Date local", () => {
    const d = parsePeriodoId("30/8/2026");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // agosto = índice 7
    expect(d.getDate()).toBe(30);
  });
});

describe("estadisticasPeriodos", () => {
  it("mediana, desvío y CV del gasto puro", () => {
    const ps = [10_000, 20_000, 30_000].map((g) => periodo({ gastadoPuro: g }));
    expect(estadisticasPeriodos(ps)).toEqual({ mediana: 20_000, desvio: 8165, cv: 41 });
  });
  it("null si no hay gasto positivo", () => {
    expect(estadisticasPeriodos([periodo({ gastadoPuro: 0 })])).toBeNull();
  });
});

describe("ritmoGasto", () => {
  it("período en curso: ritmo diario y proyección a 30 días", () => {
    const p = periodo({ periodoId: "1/1/2026", gastadoPuro: 30_000 });
    const r = ritmoGasto(p, null, new Date(2026, 0, 11)); // 10 días transcurridos
    expect(r.diasTranscurridos).toBe(10);
    expect(r.gastadoPorDia).toBe(3_000);
    expect(r.proyeccionCierre).toBe(90_000);
    expect(r.enCurso).toBe(true);
  });
});

describe("serieTendencia", () => {
  // Entrada en orden descendente (más nuevo primero), como agruparPorPeriodo.
  const P = (id: string, extra: Partial<PeriodoResumen>) => periodo({ periodoId: id, ...extra });

  it("sin seed: acumula desde los últimos 2 períodos", () => {
    const desc = [P("3/1/2026", { moveAhorros: 30 }), P("2/1/2026", { moveAhorros: 50 }), P("1/1/2026", { moveAhorros: 100 })];
    const serie = serieTendencia(desc); // → cron [P1, P2, P3]
    expect(serie.map((s) => s.ahorrosAcum)).toEqual([0, 50, 80]); // P1 fuera de la ventana
  });

  it("con seed: ancla la acumulación desde ese período", () => {
    const desc = [P("3/1/2026", { moveAhorros: 30 }), P("2/1/2026", { moveAhorros: 50 }), P("1/1/2026", { moveAhorros: 100 })];
    const serie = serieTendencia(desc, "1/1/2026");
    expect(serie.map((s) => s.ahorrosAcum)).toEqual([100, 150, 180]);
  });

  it("un retiro mayor al acumulado clampa a 0 (no queda negativo)", () => {
    const desc = [P("2/1/2026", { moveDisponible: 150 }), P("1/1/2026", { moveAhorros: 100 })];
    const serie = serieTendencia(desc, "1/1/2026");
    expect(serie.map((s) => s.ahorrosAcum)).toEqual([100, 0]);
  });
});

describe("inflacionPersonal", () => {
  // Descendente; el primero (en curso) se excluye del cálculo.
  const desc = [
    periodo({ periodoId: "1/3/2026", movimientos: gastos(999_999) }), // en curso: ignorado
    periodo({ periodoId: "1/2/2026", movimientos: gastos(150_000) }),
    periodo({ periodoId: "1/1/2026", movimientos: gastos(100_000) }),
  ];

  it("promedia las variaciones nominales del gasto puro", () => {
    expect(inflacionPersonal(desc)).toBeCloseTo(50); // (150k−100k)/100k
  });

  it("aplica la deflación cuando se pasa (variación real)", () => {
    // Deflactar feb a términos de ene (÷1.5) deja ambos en 100k → 0% real.
    const deflate = (g: number, id: string) => (id === "1/2/2026" ? g / 1.5 : g);
    expect(inflacionPersonal(desc, deflate)).toBeCloseTo(0);
  });

  it("null con menos de 2 períodos completos", () => {
    expect(inflacionPersonal([periodo({ periodoId: "1/2/2026", movimientos: gastos(100_000) })])).toBeNull();
  });
});

describe("variacionGastoVsAnterior (Inicio: período EN CURSO vs. el anterior)", () => {
  // periodos viene DESC: [0] = en curso, [1] = anterior.
  const desc = [
    periodo({ periodoId: "1/2/2026", movimientos: gastos(60_000) }),  // en curso
    periodo({ periodoId: "1/1/2026", movimientos: gastos(100_000) }), // anterior
  ];

  it("compara el período en curso contra todo el anterior", () => {
    // 60k vs 100k → -40%
    expect(variacionGastoVsAnterior(desc)).toBeCloseTo(-40);
  });

  it("da positivo si ya gastaste más que el período anterior", () => {
    const más = [
      periodo({ periodoId: "1/2/2026", movimientos: gastos(130_000) }),
      periodo({ periodoId: "1/1/2026", movimientos: gastos(100_000) }),
    ];
    expect(variacionGastoVsAnterior(más)).toBeCloseTo(30);
  });

  it("aplica la deflación cuando se pasa (variación real)", () => {
    // Deflactar el actual ÷1.2 → 50k vs 100k = -50% real.
    const deflate = (g: number, id: string) => (id === "1/2/2026" ? g / 1.2 : g);
    expect(variacionGastoVsAnterior(desc, deflate)).toBeCloseTo(-50);
  });

  it("null con menos de 2 períodos", () => {
    expect(variacionGastoVsAnterior([desc[0]])).toBeNull();
  });

  it("null si el período anterior no tuvo gasto (no se puede dividir)", () => {
    const sinGastoPrev = [desc[0], periodo({ periodoId: "1/1/2026", movimientos: [] })];
    expect(variacionGastoVsAnterior(sinGastoPrev)).toBeNull();
  });
});

describe("progresoMetaPropia (meta en moneda propia, sobre ahorros acumulados)", () => {
  // serie: el último punto tiene el ahorrosAcum vigente; `ahorros` = aporte del período.
  // El ritmo se mide sobre `ahorroNeto` de los períodos CERRADOS (se excluye el último, en
  // curso). Con 100k netos por período y 200k faltantes → 2 períodos.
  const serie = [
    { periodoId: "1/1/2026", sueldo: 0, gastado: 0, gastadoPuro: 0, disponible: 0, total: 0, ahorros: 100_000, ahorroNeto: 100_000, deltaAcum: 100_000, ahorrosAcum: 100_000 },
    { periodoId: "1/2/2026", sueldo: 0, gastado: 0, gastadoPuro: 0, disponible: 0, total: 0, ahorros: 100_000, ahorroNeto: 100_000, deltaAcum: 100_000, ahorrosAcum: 200_000 },
    { periodoId: "1/3/2026", sueldo: 0, gastado: 0, gastadoPuro: 0, disponible: 0, total: 0, ahorros: 100_000, ahorroNeto: 100_000, deltaAcum: 100_000, ahorrosAcum: 300_000 },
  ];

  it("calcula acumulado, % y faltante", () => {
    const r = progresoMetaPropia(serie, 500_000);
    expect(r).not.toBeNull();
    expect(r!.acumulado).toBe(300_000);
    expect(r!.pct).toBe(60);         // 300k / 500k
    expect(r!.faltante).toBe(200_000);
  });

  it("estima períodos para llegar por el ritmo de ahorro", () => {
    // ritmo ~100k/período, faltan 200k → 2 períodos.
    expect(progresoMetaPropia(serie, 500_000)!.periodos).toBe(2);
  });

  it("cap del % en 100 cuando ya la superaste", () => {
    const r = progresoMetaPropia(serie, 250_000);
    expect(r!.pct).toBe(100);
    expect(r!.faltante).toBe(0);
    expect(r!.periodos).toBe(0);
  });

  it("null sin meta o sin serie", () => {
    expect(progresoMetaPropia(serie, 0)).toBeNull();
    expect(progresoMetaPropia([], 500_000)).toBeNull();
  });
});

describe("ritmoAhorro (base única de las proyecciones)", () => {
  const punto = (id: string, neto: number, acum: number) => ({
    periodoId: id, sueldo: 0, gastado: 0, gastadoPuro: 0, disponible: 0, total: 0,
    ahorros: neto, ahorroNeto: neto, deltaAcum: neto, ahorrosAcum: acum,
  });

  it("usa el ahorro NETO, no el bruto: los retiros a disponible bajan el ritmo", () => {
    // Bruto 100k por período, pero el del medio devolvió 60k a disponible → neto 40k.
    const conRetiro = [
      { ...punto("1/1/2026", 100_000, 100_000), ahorros: 100_000, ahorroNeto: 100_000 },
      { ...punto("1/2/2026", 40_000, 140_000), ahorros: 100_000, ahorroNeto: 40_000 },
      { ...punto("1/3/2026", 100_000, 240_000), ahorros: 100_000, ahorroNeto: 100_000 },
    ];
    // (100k + 40k + 100k) / 3 = 80k, no los 100k que daría el bruto.
    expect(ritmoAhorro(conRetiro)).toBe(80_000);
  });

  it("retiro MAYOR al acumulado: el ritmo sigue al acumulado real, no al neto crudo", () => {
    // El acumulado no puede ser negativo: si sacás 500k teniendo 50k, baja a 0 (no a -450k).
    // El ritmo tiene que explicar ESE movimiento — antes promediaba el neto crudo y daba
    // -140k/período mientras el acumulado mostrado al lado era +30k.
    const serie = [
      { ...punto("1/1/2026", 50_000, 50_000) },
      { ...punto("1/2/2026", -500_000, 0), ahorroNeto: -500_000, deltaAcum: -50_000 },
      { ...punto("1/3/2026", 30_000, 30_000) },
    ];
    // (50k - 50k + 30k) / 3 = 10k. Con el neto crudo daba (50k - 500k + 30k)/3 = -140k.
    expect(ritmoAhorro(serie)).toBe(10_000);
  });

  it("serieTendencia calcula deltaAcum recortado por el clamp a 0", () => {
    const movs: Movimiento[] = [
      mov({ fecha: "2026-01-01", periodoId: "1/1/2026", tipo: "Ingreso", categoria: "Sueldo", monto: 100_000 }),
      mov({ fecha: "2026-01-05", periodoId: "1/1/2026", tipo: "Move", direccionMove: "aAhorro", monto: 50_000 }),
      mov({ fecha: "2026-02-01", periodoId: "1/2/2026", tipo: "Ingreso", categoria: "Sueldo", monto: 100_000 }),
      mov({ fecha: "2026-02-05", periodoId: "1/2/2026", tipo: "Move", direccionMove: "aDisponible", monto: 500_000 }),
    ];
    const s = serieTendencia(agruparPorPeriodo(movs), "1/1/2026");
    const segundo = s[1]!;
    expect(segundo.ahorroNeto).toBe(-500_000); // lo que se movió nominalmente
    expect(segundo.deltaAcum).toBe(-50_000);   // lo que el acumulado REALMENTE bajó
    expect(segundo.ahorrosAcum).toBe(0);       // clampeado, nunca negativo
  });

  it("sin clamp de por medio, deltaAcum coincide con ahorroNeto", () => {
    const movs: Movimiento[] = [
      mov({ fecha: "2026-01-01", periodoId: "1/1/2026", tipo: "Ingreso", categoria: "Sueldo", monto: 100_000 }),
      mov({ fecha: "2026-01-05", periodoId: "1/1/2026", tipo: "Move", direccionMove: "aAhorro", monto: 80_000 }),
      mov({ fecha: "2026-02-01", periodoId: "1/2/2026", tipo: "Ingreso", categoria: "Sueldo", monto: 100_000 }),
      mov({ fecha: "2026-02-05", periodoId: "1/2/2026", tipo: "Move", direccionMove: "aDisponible", monto: 30_000 }),
    ];
    const s = serieTendencia(agruparPorPeriodo(movs), "1/1/2026");
    for (const p of s) expect(p.deltaAcum).toBe(p.ahorroNeto);
  });

  it("serieTendencia expone ahorroNeto descontando los moves a disponible", () => {
    // Deposita 100k (ahorros + moveAhorros) pero devuelve 30k a disponible → bruto 100k, neto 70k.
    const s = serieTendencia([periodo({ periodoId: "1/2/2026", ahorros: 100_000, moveDisponible: 30_000 })]);
    const ultimo = s[s.length - 1]!;
    expect(ultimo.ahorros).toBe(100_000);
    expect(ultimo.ahorroNeto).toBe(70_000);
  });

  it("INCLUYE el período en curso: lo ahorrado este período cuenta en el ritmo", () => {
    // Regresión: al excluirlo, alguien que ahorró 300k este período veía "ritmo 0" mientras
    // el acumulado (que sí lo cuenta) mostraba la plata. Los dos números se contradecían.
    const serie = [punto("1/1/2026", 0, 0), punto("1/2/2026", 0, 0), punto("1/3/2026", 300_000, 300_000)];
    expect(ritmoAhorro(serie)).toBe(100_000); // 300k / 3, no 0
  });

  it("promedia TODO desde el seed, no una ventana fija", () => {
    // Con seed en el 3er período, los 2 viejos (10k) quedan fuera: (90+100+110)/3 = 100k.
    const serie = [
      punto("1/1/2026", 10_000, 10_000), punto("1/2/2026", 10_000, 20_000),
      punto("1/3/2026", 90_000, 110_000), punto("1/4/2026", 100_000, 210_000),
      punto("1/5/2026", 110_000, 320_000),
    ];
    expect(ritmoAhorro(serie, undefined, "1/3/2026")).toBe(100_000);
  });

  it("sin seed usa toda la serie", () => {
    // (10+10+90+100+110)/5 = 64k: entra todo, incluidos los períodos viejos.
    const serie = [
      punto("1/1/2026", 10_000, 10_000), punto("1/2/2026", 10_000, 20_000),
      punto("1/3/2026", 90_000, 110_000), punto("1/4/2026", 100_000, 210_000),
      punto("1/5/2026", 110_000, 320_000),
    ];
    expect(ritmoAhorro(serie)).toBe(64_000);
  });

  it("seed inexistente cae a la serie completa (no rompe)", () => {
    const serie = [punto("1/1/2026", 100_000, 100_000), punto("1/2/2026", 200_000, 300_000)];
    expect(ritmoAhorro(serie, undefined, "9/9/2099")).toBe(150_000);
  });

  it("aplica el deflactor a cada período", () => {
    const serie = [punto("1/1/2026", 100_000, 100_000), punto("1/2/2026", 100_000, 200_000)];
    expect(ritmoAhorro(serie, (m) => m * 2)).toBe(200_000);
  });

  it("null si no hay serie", () => {
    expect(ritmoAhorro([])).toBeNull();
  });
});

describe("kpisPeriodo — día pico y gasto más grande", () => {
  const per = (movs: Movimiento[]): PeriodoResumen => ({
    periodoId: "1/6/2026", sueldo: 0, extras: 0, total: 0, gastado: 0, gastadoPuro: 0,
    ahorros: 0, resto: 0, disponible: 0, moveDisponible: 0, moveAhorros: 0, pct: 0, movimientos: movs,
  });

  it("el día de mayor gasto trae cuántos movimientos tuvo ese día", () => {
    const k = kpisPeriodo(per([
      mov({ tipo: "Gasto", monto: 5000, fecha: "2026-06-10" }),
      mov({ tipo: "Gasto", monto: 3000, fecha: "2026-06-10" }),
      mov({ tipo: "Gasto", monto: 1000, fecha: "2026-06-12" }),
    ]));
    expect(k.diaMayorGasto).toEqual({ fecha: "2026-06-10", monto: 8000, movs: 2 });
  });

  it("encuentra el gasto individual más caro con su descripción", () => {
    const k = kpisPeriodo(per([
      mov({ tipo: "Gasto", monto: 2000, fecha: "2026-06-01", descripcion: "café" }),
      mov({ tipo: "Gasto", monto: 90000, fecha: "2026-06-05", descripcion: "heladera" }),
    ]));
    expect(k.gastoMasGrande).toEqual({ monto: 90000, descripcion: "heladera", fecha: "2026-06-05" });
  });

  it("sin descripción, el gasto más grande cae en la categoría", () => {
    const k = kpisPeriodo(per([mov({ tipo: "Gasto", monto: 5000, categoria: "Varios", descripcion: "" })]));
    expect(k.gastoMasGrande?.descripcion).toBe("Varios");
  });

  it("sin gastos, día pico y gasto más grande son null", () => {
    const k = kpisPeriodo(per([mov({ tipo: "Ingreso", categoria: "Sueldo", monto: 500000 })]));
    expect(k.diaMayorGasto).toBeNull();
    expect(k.gastoMasGrande).toBeNull();
  });
});

describe("periodosHastaFecha", () => {
  const hoy = new Date("2026-06-01T00:00:00Z");

  it("redondea hacia arriba: 35 días con período de 30 → 2 períodos, no 1.17", () => {
    expect(periodosHastaFecha("2026-07-06", 30, hoy)).toBe(2); // 35 días
  });

  it("exactamente 1 período (30 días) → 1", () => {
    expect(periodosHastaFecha("2026-07-01", 30, hoy)).toBe(1); // 30 días
  });

  it("0 si la fecha ya pasó", () => {
    expect(periodosHastaFecha("2026-05-01", 30, hoy)).toBe(0);
  });

  it("0 si la fecha es hoy (sin margen)", () => {
    expect(periodosHastaFecha("2026-06-01", 30, hoy)).toBe(0);
  });

  it("mínimo 1 período aunque falten pocos días", () => {
    expect(periodosHastaFecha("2026-06-05", 30, hoy)).toBe(1); // 4 días, redondea a 1 igual
  });

  it("null con fecha inválida", () => {
    expect(periodosHastaFecha("", 30, hoy)).toBeNull();
  });
});

describe("ritmoNecesarioParaFecha", () => {
  it("faltante dividido en los períodos disponibles", () => {
    expect(ritmoNecesarioParaFecha(10000, 4)).toBe(2500);
  });

  it("0 si la meta ya está alcanzada (faltante ≤ 0)", () => {
    expect(ritmoNecesarioParaFecha(0, 4)).toBe(0);
    expect(ritmoNecesarioParaFecha(-500, 4)).toBe(0);
  });

  it("null sin períodos por delante (fecha ya pasó)", () => {
    expect(ritmoNecesarioParaFecha(10000, 0)).toBeNull();
    expect(ritmoNecesarioParaFecha(10000, null)).toBeNull();
  });
});
