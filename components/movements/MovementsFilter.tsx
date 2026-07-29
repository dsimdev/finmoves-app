"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/hooks/useTranslation";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";
import { useMounted } from "@/hooks/useMounted";
import { movMatchesAny } from "@/utils/search";
import type { Movimiento } from "@/types";

// Filtro in-place de Movimientos: popover anclado a la lupa del header (mismo molde que el
// panel de notificaciones). No navega: los términos elegidos acotan la lista en la misma
// pantalla. Pills OR + preview de cuántos coinciden antes de fijar.
//
// Ámbito: por defecto acota al período seleccionado. Con "todos los períodos" la búsqueda
// pasa a ser global y el selector de año/período de la pantalla se reduce a los que tienen
// coincidencias (la navegación por pills sigue siendo la misma, solo se acorta).
export function MovementsFilter({ open, onClose, movs, movsGlobal, terms, onChange, todosPeriodos, onTodosPeriodosChange, anchorRef }: {
  open: boolean;
  onClose: () => void;
  /** Botón que lo abre: el popover se ancla ahí en vez de a un top fijo. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Movimientos del período seleccionado (para el preview de coincidencias). */
  movs: Movimiento[];
  /** Todos los movimientos (preview cuando el ámbito es global). */
  movsGlobal: Movimiento[];
  terms: string[];
  onChange: (terms: string[]) => void;
  todosPeriodos: boolean;
  onTodosPeriodosChange: (v: boolean) => void;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  const mounted = useMounted();
  // Igual que el panel de notificaciones: la distancia se mide del ícono que lo abre, para
  // que no dependa de cuán alto sea el header de cada pantalla.
  const [top, setTop] = useState<number | null>(null);
  useScrollLock(open);
  useModalBack(open, onClose);
  useEffect(() => {
    if (!open) return;
    const r = anchorRef?.current?.getBoundingClientRect();
    if (r) setTop(r.bottom + 8);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, anchorRef]);

  const addTerm = () => {
    const v = input.trim();
    if (!v) return;
    if (!terms.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...terms, v]);
    setInput("");
  };
  const removeTerm = (v: string) => onChange(terms.filter((x) => x !== v));

  // Preview: cuántos coinciden con lo tipeado (sin fijarlo aún), sobre el ámbito elegido.
  // En global además se cuenta en cuántos períodos distintos aparece, que es lo que va a
  // quedar en el selector de pills al fijar el término.
  const termino = input.trim();
  const base = todosPeriodos ? movsGlobal : movs;
  const matches = termino ? base.filter((m) => movMatchesAny(m, [termino])) : null;
  const previewCount = matches?.length ?? null;
  const previewPeriodos = todosPeriodos && matches ? new Set(matches.map((m) => m.periodoId)).size : 0;

  if (!mounted || !open) return null;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div
        data-movfilter
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", right: 12,
          top: top ?? "calc(env(safe-area-inset-top, 0px) + 54px)",
          width: "min(360px, calc(100vw - 24px))", maxHeight: "70vh", overflowY: "auto",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
          boxShadow: "0 14px 44px rgba(0,0,0,0.5)", transformOrigin: "top right",
          animation: "appearPopover var(--open-dur) var(--ease-out)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 8px" }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>{t.filterTitle}</span>
          <button onClick={onClose} aria-label="×" style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 4, margin: -4 }}>×</button>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, marginBottom: 10 }}>{t.filterHint}</div>

          {terms.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {terms.map((term) => (
                <span key={term} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 13, fontWeight: 600 }}>
                  {term}
                  <button type="button" onClick={() => removeTerm(term)} aria-label={t.remove} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ position: "relative" }}>
            <input
              className="input" value={input} onChange={(e) => setInput(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTerm(); } }}
              placeholder={t.filterPlaceholder} enterKeyHint="search" style={{ paddingRight: 46 }}
            />
            <button type="button" onClick={addTerm} disabled={!input.trim()} aria-label={t.add} style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: 9, border: "none",
              background: input.trim() ? "var(--accent)" : "var(--surface-alt)", color: input.trim() ? "#fff" : "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "default",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>
          {previewCount !== null && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: previewCount > 0 ? "var(--green)" : "var(--muted)" }}>
              {previewCount > 0
                ? `${t.filterPreview(previewCount)}${previewPeriodos > 1 ? ` · ${t.filterPeriodsFound(previewPeriodos)}` : ""}`
                : (todosPeriodos ? t.filterNoResultsGlobal : t.filterNoResults)}
            </div>
          )}

          {/* Ámbito de la búsqueda. Al pasar a global, el selector de año/período de la
              pantalla se reduce a los que tienen coincidencias (no hace falta otra vista). */}
          <button
            type="button"
            role="switch"
            aria-checked={todosPeriodos}
            onClick={() => onTodosPeriodosChange(!todosPeriodos)}
            style={{
              display: "flex", alignItems: "center", gap: 9, width: "100%", marginTop: 12,
              background: "none", border: "none", padding: "4px 0", cursor: "pointer",
              color: todosPeriodos ? "var(--accent)" : "var(--muted)", fontSize: 12.5, fontWeight: 600,
            }}
          >
            <span style={{
              width: 34, height: 19, borderRadius: 999, flexShrink: 0, position: "relative", display: "block",
              background: todosPeriodos ? "var(--accent)" : "var(--surface-alt)",
              border: `1px solid ${todosPeriodos ? "var(--accent)" : "var(--border)"}`, transition: "background .15s",
            }}>
              <span style={{
                position: "absolute", top: 2, left: todosPeriodos ? 16 : 2, width: 13, height: 13,
                borderRadius: "50%", background: "#fff", transition: "left .15s",
              }} />
            </span>
            {t.filterAllPeriods}
          </button>

          {terms.length > 0 && (
            <button onClick={() => onChange([])} style={{ width: "100%", marginTop: 12, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t.filterClear}</button>
          )}
        </div>
      </div>
      <style>{`
        @media (prefers-reduced-motion: reduce) { [data-movfilter] { animation: none !important } }
      `}</style>
    </div>,
    document.body
  ) as ReactNode;
}
