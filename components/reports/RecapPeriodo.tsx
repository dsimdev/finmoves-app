"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { useMounted } from "@/hooks/useMounted";
import { fechaCorta } from "@/utils/periodo";
import type { RecapPeriodo as Recap } from "@/utils/recap-periodo";

// Panel de recap de un período que cerró. A diferencia del Wrapped anual (carrusel a pantalla
// completa, una vez al año), esto es UN panel con el resumen extendido: pasa cada cierre, así
// que tiene que leerse de un vistazo, no navegarse.

/** Δ% con flecha y color. Rojo/verde según si subir es bueno (ahorro) o malo (gasto). */
function Delta({ pct, subirEsBueno }: { pct: number | null; subirEsBueno?: boolean }) {
  if (pct == null) return null;
  if (pct === 0) return <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>0%</span>;
  const bueno = subirEsBueno ? pct > 0 : pct < 0;
  const color = bueno ? "var(--green)" : "var(--red)";
  return (
    <span style={{ fontSize: 12, color, fontWeight: 700 }}>
      {pct > 0 ? "↑" : "↓"}{Math.abs(pct)}%
    </span>
  );
}

export function RecapPeriodo({ open, onClose, recap }: { open: boolean; onClose: () => void; recap: Recap | null }) {
  const t = useT();
  const { m: money } = useMoney();
  const mounted = useMounted();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open || !recap) return null;

  const [d, m] = recap.periodoId.split("/");

  const stat = (label: string, value: string, extra?: ReactNode, color?: string) => (
    <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "13px 14px" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: color ?? "var(--text)" }}>{value}</span>
        {extra}
      </div>
    </div>
  );

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(460px, 100%)", maxHeight: "88vh", overflowY: "auto",
          background: "var(--surface)", borderTopLeftRadius: 22, borderTopRightRadius: 22,
          border: "1px solid var(--border)", borderBottom: "none",
          padding: "22px 18px calc(env(safe-area-inset-bottom, 0px) + 22px)",
          animation: "recapUp var(--open-dur) var(--ease-settle)",
        }}
        data-recap
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{t.recapTitle}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3, marginTop: 3 }}>{t.recapPeriodClosed(`${d}/${m}`)}</div>
          </div>
          <button onClick={onClose} aria-label={t.close} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4, margin: -4 }}>×</button>
        </div>

        {/* Los dos números que importan: gastado y ahorrado, con su Δ vs el período anterior. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {stat(t.spent, money(recap.gastado), <Delta pct={recap.gastadoVs.deltaPct} />, "var(--red)")}
          {stat(t.savings, money(recap.ahorrado), <Delta pct={recap.ahorradoVs.deltaPct} subirEsBueno />, "var(--blue)")}
        </div>

        {/* La categoría que más se disparó vs el período pasado: lo accionable del recap. */}
        {recap.categoriaQueMasSubio && (
          <div style={{ background: "var(--red-dim)", border: "1px solid color-mix(in srgb, var(--red) 30%, var(--border))", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>{t.recapBiggestJump}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{recap.categoriaQueMasSubio.categoria}</div>
            </div>
            {/* El aumento en PESOS es el dato; el % solo si es razonable (ver recap-periodo). */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--red)", fontFamily: "var(--font-mono)" }}>+{money(recap.categoriaQueMasSubio.deltaMonto)}</div>
              {recap.categoriaQueMasSubio.deltaPct != null && (
                <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 1 }}>↑{recap.categoriaQueMasSubio.deltaPct}%</div>
              )}
            </div>
          </div>
        )}

        {/* Resumen extendido: los datos de "cómo se movió" el período. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {stat(t.recapCarriedOver, money(recap.disponibleArrastrado), undefined, recap.disponibleArrastrado >= 0 ? "var(--green)" : "var(--red)")}
          {stat(t.recapMovements, String(recap.cantMovimientos))}
          {stat(t.avgPerExpense, money(recap.promedioPorMovimiento))}
          {recap.diaMayorGasto && stat(t.highestSpendingDay, fechaCorta(recap.diaMayorGasto.fecha), <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{money(recap.diaMayorGasto.monto)}</span>)}
        </div>
      </div>

      <style>{`
        @keyframes recapUp { from { transform: translateY(30px); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { [data-recap] { animation: none !important } }
      `}</style>
    </div>,
    document.body
  ) as ReactNode;
}
