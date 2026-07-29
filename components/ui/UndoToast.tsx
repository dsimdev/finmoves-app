"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/useMounted";

// Aviso con acción de deshacer, para operaciones destructivas que ya se ejecutaron (borrado en
// lote). Se auto-cierra: si no se toca "Deshacer" en unos segundos, la acción queda firme.
//
// La barra de progreso hace visible el tiempo que queda — un toast que desaparece sin aviso
// obliga a apurarse a ciegas.

export function UndoToast({ mensaje, accion, duracionMs = 6000, onUndo, onDismiss }: {
  mensaje: string;
  /** Texto del botón ("Deshacer"). */
  accion: string;
  duracionMs?: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const mounted = useMounted();

  useEffect(() => {
    const id = setTimeout(onDismiss, duracionMs);
    return () => clearTimeout(id);
  }, [duracionMs, onDismiss]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="status"
      style={{
        position: "fixed", left: 12, right: 12, zIndex: 9999,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)", // sobre la barra de tabs
        maxWidth: 440, marginInline: "auto",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
        boxShadow: "0 10px 34px rgba(0,0,0,.45)", overflow: "hidden",
        animation: "undoToastIn .18s cubic-bezier(.2,.9,.3,1.1)",
      }}
      data-undotoast
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{mensaje}</span>
        <button
          onClick={onUndo}
          style={{
            background: "none", border: "none", color: "var(--accent)", cursor: "pointer",
            fontSize: 13, fontWeight: 700, padding: "4px 2px", flexShrink: 0,
          }}
        >
          {accion}
        </button>
      </div>
      {/* Cuánto queda para que el borrado sea definitivo. */}
      <div style={{ height: 2, background: "var(--faint)" }}>
        <div style={{ height: "100%", background: "var(--accent)", animation: `undoToastBar ${duracionMs}ms linear forwards` }} />
      </div>
      <style>{`
        @keyframes undoToastIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes undoToastBar { from { width: 100% } to { width: 0% } }
        @media (prefers-reduced-motion: reduce) {
          [data-undotoast] { animation: none !important }
          [data-undotoast] div > div { animation-duration: 0s !important }
        }
      `}</style>
    </div>,
    document.body
  ) as ReactNode;
}
