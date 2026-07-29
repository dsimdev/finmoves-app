"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/app/(tabs)/data-context";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useInflacionIPC } from "@/hooks/useInflacionIPC";
import { useMoney } from "@/hooks/useHideValues";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";

type Slide = { bg: string; accent: string; kicker: string; hero: string; label: string; sub?: string };

// Años con datos (cerrados + el año en curso), más reciente primero. NO decide CUÁNDO
// mostrar el recap: de eso se encarga el llamador (Reportes lo ofrece solo en la ventana
// de fin de año, 26/12–5/1). Antes esta función tenía el gate "solo diciembre" adentro,
// lo que hacía imposible mostrarlo los primeros días de enero.
export function wrappedYears(movimientos: { fecha: string }[]): string[] {
  return Array.from(new Set(movimientos.map((m) => m.fecha.slice(0, 4)))).filter(Boolean).sort((a, b) => b.localeCompare(a));
}

const mesNombre = (mes: string, year: string) =>
  new Date(Number(year), Number(mes) - 1, 1).toLocaleDateString("es-AR", { month: "long" });

export function YearWrapped({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { movimientos } = useData();
  const { monedaPrincipal } = useAppPrefs();
  const { ipcVar } = useInflacionIPC();
  const { m: money } = useMoney();
  useScrollLock(open);
  useModalBack(open, onClose);

  const years = useMemo(() => wrappedYears(movimientos), [movimientos]);
  const [year, setYear] = useState(years[0] ?? "");
  const [i, setI] = useState(0);
  // `i` es estado real (el usuario navega los slides); este efecto solo lo REINICIA al
  // reabrir. Mismo caso que BottomSheet.ty: el patrón "ajustar durante el render" que sugiere
  // React requeriría mutar un ref en el cuerpo del render, que el compiler de este proyecto
  // rechaza.
  useEffect(() => { if (open) setI(0); }, [open]); // eslint-disable-line react-hooks/set-state-in-effect

  const slides = useMemo<Slide[]>(() => {
    if (!year) return [];
    const movs = movimientos.filter((m) => m.fecha.slice(0, 4) === year);
    let gastado = 0, ahorrado = 0;
    const catMap = new Map<string, number>();
    const ahorroMes = new Map<string, number>();
    for (const m of movs) {
      if (m.tipo === "Gasto") { gastado += m.monto; catMap.set(m.categoria, (catMap.get(m.categoria) ?? 0) + m.monto); }
      const esAhorro = (m.tipo === "Move" && m.direccionMove === "aAhorro") || (m.tipo === "Ingreso" && m.categoria === "Ahorros");
      if (esAhorro) { ahorrado += m.monto; const mo = m.fecha.slice(5, 7); ahorroMes.set(mo, (ahorroMes.get(mo) ?? 0) + m.monto); }
    }
    const catTop = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const mejorMes = [...ahorroMes.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const pYear = agruparPorPeriodo(movimientos).filter((p) => p.periodoId.split("/")[2] === year)
      .sort((a, b) => parsePeriodoId(a.periodoId).getTime() - parsePeriodoId(b.periodoId).getTime());
    let vosInfl: number | null = null, paisInfl: number | null = null, subaSueldo: number | null = null;
    if (pYear.length >= 2) {
      const first = pYear[0], last = pYear[pYear.length - 1];
      if (first.gastadoPuro > 0) vosInfl = Math.round((last.gastadoPuro / first.gastadoPuro - 1) * 100);
      const pais = ipcVar(first.periodoId, last.periodoId); paisInfl = pais != null ? Math.round(pais) : null;
      const sueldos = pYear.filter((p) => p.sueldo > 0);
      if (sueldos.length >= 2 && sueldos[0].sueldo > 0) subaSueldo = Math.round((sueldos[sueldos.length - 1].sueldo / sueldos[0].sueldo - 1) * 100);
    }

    const s: Slide[] = [];
    s.push({ bg: "linear-gradient(160deg, #1a1f3a, #0b0e1c)", accent: "var(--accent)", kicker: "Tu año en FinMoves", hero: year, label: "Mirá cómo te fue 👇" });
    s.push({ bg: "linear-gradient(160deg, #3a1320, #0b0e1c)", accent: "var(--red)", kicker: "Gastaste", hero: money(gastado), label: `en ${movs.length} movimientos` });
    if (catTop) s.push({ bg: "linear-gradient(160deg, #3a1320, #0b0e1c)", accent: "var(--red)", kicker: "Donde más gastaste", hero: catTop[0], label: money(catTop[1]) });
    s.push({ bg: "linear-gradient(160deg, #0e2a3a, #0b0e1c)", accent: "var(--blue)", kicker: "Ahorraste", hero: money(ahorrado), label: ahorrado > 0 ? "💪 bien ahí" : "el próximo año arrancamos" });
    if (mejorMes) s.push({ bg: "linear-gradient(160deg, #0e2a3a, #0b0e1c)", accent: "var(--blue)", kicker: "Tu mejor mes de ahorro", hero: mesNombre(mejorMes[0], year), label: money(mejorMes[1]) });
    if (monedaPrincipal === "ARS" && vosInfl != null && paisInfl != null) {
      const contuvo = vosInfl <= paisInfl; // tu gasto subió menos que la inflación = bueno
      s.push({ bg: contuvo ? "linear-gradient(160deg, #13351f, #0b0e1c)" : "linear-gradient(160deg, #3a2410, #0b0e1c)", accent: contuvo ? "var(--green)" : "var(--yellow)", kicker: "Tu inflación vs el país", hero: `${vosInfl >= 0 ? "+" : ""}${vosInfl}% vs +${paisInfl}%`, label: contuvo ? "tu gasto subió menos que la inflación 👏" : "tu gasto subió más que la inflación" });
    }
    if (subaSueldo != null) s.push({ bg: "linear-gradient(160deg, #13351f, #0b0e1c)", accent: "var(--green)", kicker: "Tu sueldo subió", hero: `+${subaSueldo}%`, label: "en el año" });
    s.push({ bg: "linear-gradient(160deg, #1a1f3a, #0b0e1c)", accent: "var(--accent)", kicker: `Tu ${year}`, hero: `${movs.length}`, label: "movimientos registrados · ¡gracias por usar FinMoves!" });
    return s;
  }, [movimientos, year, ipcVar, monedaPrincipal, money]);

  if (!open) return null;
  if (slides.length === 0) return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0b0e1c", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>Sin datos todavía. Tocá para cerrar.</div>,
    document.body
  );

  const cur = slides[Math.min(i, slides.length - 1)];
  const next = () => setI((v) => (v < slides.length - 1 ? v + 1 : v));
  const prev = () => setI((v) => Math.max(0, v - 1));

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: cur.bg, transition: "background .4s ease", display: "flex", flexDirection: "column", color: "#fff", WebkitUserSelect: "none", userSelect: "none" }}>
      {/* Progreso */}
      <div style={{ display: "flex", gap: 4, padding: "10px 12px 0" }}>
        {slides.map((_, idx) => (
          <div key={idx} style={{ flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: idx < i ? "100%" : idx === i ? "100%" : "0%", background: "#fff", transition: "width .3s" }} />
          </div>
        ))}
      </div>

      {/* Header: año + cerrar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {years.slice(0, 4).map((y) => (
            <button key={y} onClick={() => { setYear(y); setI(0); }} style={{ background: y === year ? "rgba(255,255,255,0.18)" : "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{y}</button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
      </div>

      {/* Contenido del slide */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: cur.accent, letterSpacing: 0.5, marginBottom: 16, textTransform: "uppercase" }}>{cur.kicker}</div>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05, fontFamily: "var(--font-mono)" }}>{cur.hero}</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 18, lineHeight: 1.5 }}>{cur.label}</div>
        {cur.sub && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 10 }}>{cur.sub}</div>}
      </div>

      {/* Zonas de tap: izq=anterior, der=siguiente */}
      <button onClick={prev} aria-label="Anterior" style={{ position: "absolute", left: 0, top: 60, bottom: 0, width: "33%", background: "transparent", border: "none", cursor: "pointer" }} />
      <button onClick={next} aria-label="Siguiente" style={{ position: "absolute", right: 0, top: 60, bottom: 0, width: "67%", background: "transparent", border: "none", cursor: "pointer" }} />

      {i === slides.length - 1 && (
        <button onClick={onClose} style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#fff", color: "#0b0e1c", border: "none", borderRadius: 999, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", zIndex: 1 }}>Listo</button>
      )}
    </div>,
    document.body
  );
}
