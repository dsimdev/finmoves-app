import { describe, it, expect, vi, afterEach } from "vitest";
import { aFechaAR, ahoraAR, fechaISO_AR, mesISO_AR, fechaISO_AR_haceDias } from "@/utils/fecha-ar";

afterEach(() => vi.useRealTimers());

describe("aFechaAR", () => {
  it("resta 3h a un timestamp", () => {
    // 2026-06-15T02:00:00Z − 3h = 2026-06-14T23:00:00Z
    const d = aFechaAR(Date.UTC(2026, 5, 15, 2, 0, 0));
    expect(d.toISOString()).toBe("2026-06-14T23:00:00.000Z");
  });
  it("acepta Date o number igual", () => {
    const ms = Date.UTC(2026, 5, 15, 12);
    expect(aFechaAR(ms).getTime()).toBe(aFechaAR(new Date(ms)).getTime());
  });
});

describe("fechaISO_AR", () => {
  it("da el día AR, no el UTC, cerca de medianoche", () => {
    // 02:00 UTC del 15 es todavía el 14 en AR (23:00).
    expect(fechaISO_AR(Date.UTC(2026, 5, 15, 2))).toBe("2026-06-14");
    // 05:00 UTC del 15 ya es el 15 en AR (02:00).
    expect(fechaISO_AR(Date.UTC(2026, 5, 15, 5))).toBe("2026-06-15");
  });
  it("sin argumento usa el reloj (hoy en AR)", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-15T05:00:00Z"));
    expect(fechaISO_AR()).toBe("2026-06-15");
  });
});

describe("mesISO_AR", () => {
  it("da YYYY-MM en hora AR", () => {
    // 2026-07-01T01:00Z = 2026-06-30T22:00 AR → mes 06.
    expect(mesISO_AR(Date.UTC(2026, 6, 1, 1))).toBe("2026-06");
  });
});

describe("fechaISO_AR_haceDias", () => {
  it("resta N días respecto de hoy AR", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-15T12:00:00Z"));
    expect(fechaISO_AR_haceDias(0)).toBe("2026-06-15");
    expect(fechaISO_AR_haceDias(10)).toBe("2026-06-05");
  });
  it("cruza fin de mes hacia atrás", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-03T12:00:00Z"));
    expect(fechaISO_AR_haceDias(5)).toBe("2026-05-29");
  });
});

describe("ahoraAR", () => {
  it("devuelve el ahora desplazado a AR", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-15T12:00:00Z"));
    expect(ahoraAR().toISOString()).toBe("2026-06-15T09:00:00.000Z");
  });
});
