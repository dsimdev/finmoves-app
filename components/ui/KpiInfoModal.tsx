"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";
import { useMounted } from "@/hooks/useMounted";

/**
 * Card flotante para el detalle de un KPI de Reportes: número exacto (sin abreviar)
 * + explicación. Las cards quedan limpias y el detalle vive un toque más adentro.
 */
export function KpiInfoModal({ title, value, explain, color, onClose }: {
  title: string;
  value: string;
  explain: string;
  color?: string;
  onClose: () => void;
}) {
  const mounted = useMounted();
  useScrollLock(true);
  useModalBack(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "ccFade .16s ease-out" }}>
      {/* Apertura con el sistema de movimiento compartido (globals.css). */}
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 340, padding: 22, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", textAlign: "center", animation: "appearPop var(--open-dur) var(--ease-out)" }}>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: color ?? "var(--text)", fontFamily: "var(--font-mono)", lineHeight: 1.05, marginBottom: 12 }}>{value}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{explain}</div>
      </div>
    </div>,
    document.body
  );
}
