"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";
import { useMounted } from "@/hooks/useMounted";
import { feedback } from "@/lib/feedback";

/**
 * Modal flotante centrado para confirmaciones y advertencias (estilo unificado
 * en toda la app). Título + cuerpo libre + botones Cancelar / Confirmar.
 */
export function ConfirmModal({ title, children, confirmLabel, cancelLabel, confirmColor = "var(--accent)", loading, onConfirm, onCancel }: {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmColor?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const mounted = useMounted();
  useScrollLock(true);
  useModalBack(true, onCancel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  if (!mounted) return null;

  return createPortal(
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "ccFade .16s ease-out" }}>
      {/* Apertura con el sistema de movimiento compartido (globals.css). */}
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 340, padding: 22, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", animation: "appearPop var(--open-dur) var(--ease-out)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <button onClick={onCancel} aria-label={cancelLabel} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
        </div>
        {children && <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 22 }}>{children}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid var(--border)", background: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer" }}>{cancelLabel}</button>
          {/* El pulso sale de acá y no de cada llamador: así todo confirmar lo hereda. Rojo =
              destructivo → shake; el resto → punch de confirmación. */}
          <button onClick={(e) => { feedback(confirmColor === "var(--red)" ? "delete" : "success", e.currentTarget); onConfirm(); }} disabled={loading} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: confirmColor, color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>{loading ? "…" : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
