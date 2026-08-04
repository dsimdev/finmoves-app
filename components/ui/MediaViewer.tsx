"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";
import { useMounted } from "@/hooks/useMounted";

/**
 * Visor a pantalla completa para comprobantes, dentro de la app (sin abrir la
 * URL fea de Storage). Imágenes con pinch-zoom + doble-tap; PDFs en un iframe.
 */
export function MediaViewer({ src, isPdf, onClose }: { src: string; isPdf: boolean; onClose: () => void }) {
  const mounted = useMounted();
  useScrollLock(true);
  useModalBack(true, onClose);
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const start = useRef<{ dist: number; scale: number; cx: number; cy: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const gesturing = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const two = () => [...pointers.current.values()];
  const dist = () => { const p = two(); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  const mid = () => { const p = two(); return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      gesturing.current = true;
      const m = mid();
      start.current = { dist: dist(), scale: t.scale, cx: m.x, cy: m.y, x: t.x, y: t.y };
    } else if (pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setT((p) => (p.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));
      }
      lastTap.current = now;
      start.current = { dist: 0, scale: t.scale, cx: e.clientX, cy: e.clientY, x: t.x, y: t.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && start.current) {
      const s = start.current;
      const newScale = Math.min(5, Math.max(1, s.scale * (dist() / s.dist)));
      const m = mid();
      setT({ scale: newScale, x: s.x + (m.x - s.cx), y: s.y + (m.y - s.cy) });
    } else if (pointers.current.size === 1 && start.current && t.scale > 1) {
      const s = start.current;
      setT((p) => ({ ...p, x: s.x + (e.clientX - s.cx), y: s.y + (e.clientY - s.cy) }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) start.current = null;
    if (pointers.current.size === 0) {
      setTimeout(() => { gesturing.current = false; }, 50);
      if (t.scale <= 1.01) setT({ scale: 1, x: 0, y: 0 });
    }
  };

  // Se lee start.current a propósito (sin transición mientras hay un gesto activo). `start`
  // es ref y no useState porque cambia en cada pointermove del pinch-zoom: convertirlo a
  // estado dispararía un re-render por movimiento, justo lo que un ref evita.
  // eslint-disable-next-line react-hooks/refs
  const sinTransicion = start.current ? "none" : "transform 0.15s";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(1px)", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}>
      <button onClick={onClose} aria-label="×" style={{ position: "absolute", top: 12, right: 14, zIndex: 2, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 24, width: 40, height: 40, borderRadius: "50%", cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      {isPdf ? (
        <iframe src={src} title="PDF" style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
      ) : (
        <div onClick={(e) => { if (e.target === e.currentTarget && !gesturing.current) onClose(); }}
          style={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={src} alt="" draggable={false}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            style={{ maxWidth: "92%", maxHeight: "88%", objectFit: "contain", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)", transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transition: sinTransicion, touchAction: "none", userSelect: "none", cursor: t.scale > 1 ? "grab" : "default" }} />
        </div>
      )}
    </div>,
    document.body
  );
}
