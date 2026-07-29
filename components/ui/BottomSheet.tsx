"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useMounted } from "@/hooks/useMounted";

/**
 * Bottom-sheet genérico y arrastrable (patrón único de la app):
 * arrastrar el handle hacia abajo achica el modal (peek, sin perder lo cargado)
 * y hacia arriba lo restaura; bien abajo, cierra. El backdrop tapea para cerrar.
 *
 * `title` es opcional: si no se pasa, no se renderiza el encabezado (handle + ×).
 */
export function BottomSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [ty, setTy] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Portal a <body>: evita que un ancestro con transform (p.ej. la animación
  // .fade-up con fill `both`) capture el position:fixed y descoloque el modal.
  const mounted = useMounted();
  useScrollLock(open);
  useModalBack(open, onClose);
  // En escritorio el sheet se muestra como card centrada (ver el panel más abajo).
  const isDesktop = useIsDesktop();
  // onClose suele venir inline (nueva identidad por render). Guardarlo en un ref evita
  // que los efectos que lo usan se re-ejecuten en cada render: al tipear en un input, el
  // efecto de foco volvía a enfocar el panel y cerraba el teclado.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  const startY = useRef(0);
  const baseTy = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const tyRef = useRef(0);

  useEffect(() => { tyRef.current = ty; }, [ty]);
  // Resetear `ty` al reabrir. El patrón "ajustar durante el render" que React sugiere para
  // esto requeriría mutar un ref en el cuerpo del render, y el compiler de este proyecto lo
  // rechaza (react-hooks/refs) — el sheet tampoco puede remontar por `key` sin perder el resto
  // de su estado interno entre aperturas. El efecto sincroniza con la prop `open`, que es
  // justamente lo que un efecto debe hacer; se documenta la excepción en vez de forzar un
  // patrón que el linter del proyecto no permite.
  useEffect(() => { if (open) setTy(0); }, [open]); // eslint-disable-line react-hooks/set-state-in-effect

  // Arrastre desde el cuerpo con listeners nativos no-pasivos: mantener apretado
  // ~280ms en cualquier parte entra en modo arrastre y, con preventDefault, frena el
  // scroll nativo (los listeners pointer pasivos de React no pueden hacerlo). Si se
  // mueve antes del umbral, es scroll y se cancela.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let timer: number | null = null, drag = false, sY = 0, base = 0, lastY = 0;
    const clear = () => { if (timer != null) { clearTimeout(timer); timer = null; } };
    const onTS = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest("button,a,input,textarea,select")) return;
      sY = lastY = e.touches[0].clientY; base = tyRef.current;
      timer = window.setTimeout(() => { drag = true; setDragging(true); sY = lastY; base = tyRef.current; }, 280);
    };
    const onTM = (e: TouchEvent) => {
      lastY = e.touches[0].clientY;
      if (!drag) { if (timer != null && Math.abs(lastY - sY) > 8) clear(); return; }
      e.preventDefault();
      const h = el.closest("[role=dialog]") instanceof HTMLElement ? (el.closest("[role=dialog]") as HTMLElement).offsetHeight : 600;
      const nty = Math.min(h, Math.max(0, base + (lastY - sY)));
      tyRef.current = nty; setTy(nty);
    };
    const onTE = () => {
      clear();
      if (!drag) return;
      drag = false; setDragging(false);
      const h = el.closest("[role=dialog]") instanceof HTMLElement ? (el.closest("[role=dialog]") as HTMLElement).offsetHeight : 600;
      const cur = tyRef.current;
      if (cur > h * 0.7) onClose();
      else { const snap = cur > h * 0.25 ? h * 0.5 : 0; tyRef.current = snap; setTy(snap); }
    };
    el.addEventListener("touchstart", onTS, { passive: true });
    el.addEventListener("touchmove", onTM, { passive: false });
    el.addEventListener("touchend", onTE, { passive: true });
    el.addEventListener("touchcancel", onTE, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTS);
      el.removeEventListener("touchmove", onTM);
      el.removeEventListener("touchend", onTE);
      el.removeEventListener("touchcancel", onTE);
    };
  }, [onClose]);

  // Accesibilidad: al abrir, mover el foco al panel y atrapar Tab dentro del diálogo;
  // Escape cierra; al cerrar, devolver el foco al elemento que lo abrió.
  const lastFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const raf = requestAnimationFrame(() => panel?.focus());
    const focusablesSel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key === "Tab" && panel) {
        const f = Array.from(panel.querySelectorAll<HTMLElement>(focusablesSel));
        if (f.length === 0) { e.preventDefault(); panel.focus(); return; }
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  // Acompañar el teclado: el visualViewport se achica al abrirse el teclado, pero
  // los elementos position:fixed siguen el layout viewport (no se mueven). Atamos
  // la altura/top del contenedor al visualViewport para que el sheet quede arriba
  // del teclado en vez de taparse.
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const visualViewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!visualViewport) return;
    const sync = () => setVv({ h: visualViewport.height, top: visualViewport.offsetTop });
    sync();
    visualViewport.addEventListener("resize", sync);
    visualViewport.addEventListener("scroll", sync);
    return () => { visualViewport.removeEventListener("resize", sync); visualViewport.removeEventListener("scroll", sync); };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    // Permite arrastrar desde toda la cabecera, salvo el botón de cerrar.
    if ((e.target as HTMLElement).closest("[data-close]")) return;
    startY.current = e.clientY; baseTy.current = ty; setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const h = panelRef.current?.offsetHeight ?? 600;
    setTy(Math.min(h, Math.max(0, baseTy.current + (e.clientY - startY.current))));
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const h = panelRef.current?.offsetHeight ?? 600;
    if (ty > h * 0.7) onClose();            // arrastrado bien abajo → cerrar
    else if (ty > h * 0.25) setTy(h * 0.5); // peek (achicado, datos intactos)
    else setTy(0);                          // restaurar a pantalla completa
  };

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: "fixed", left: 0, top: vv ? vv.top : 0, width: "100%", height: vv ? vv.h : "100%", zIndex: 200, pointerEvents: open ? "all" : "none" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: open ? "blur(4px)" : "blur(0px)", WebkitBackdropFilter: open ? "blur(4px)" : "blur(0px)", opacity: open ? 1 : 0, transition: "opacity 0.35s ease, backdrop-filter 0.35s ease" }} />
      {/* En escritorio el panel deja de subir desde abajo y pasa a ser una card centrada:
          pegado al borde inferior y a 1920px de ancho no es un diálogo, es una franja. El
          arrastre y el handle son gestos táctiles → tampoco van con mouse. */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={{
        position: "absolute", background: "var(--surface)", overflowY: "auto",
        border: "1px solid var(--border)", outline: "none",
        ...(isDesktop ? {
          left: "50%", top: "50%", width: "min(560px, calc(100% - 48px))",
          maxHeight: "min(86vh, 860px)", borderRadius: 18,
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
          transform: `translate(-50%, -50%) scale(${open ? 1 : 0.97})`,
          opacity: open ? 1 : 0,
          transition: "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
        } : {
          left: 0, right: 0, bottom: 0, borderRadius: "26px 26px 0 0", maxHeight: "92%",
          borderBottom: "none", boxShadow: "0 -16px 50px rgba(0,0,0,0.5)",
          transform: open ? `translateY(${ty}px)` : "translateY(101%)",
          opacity: open ? 1 : 0.4,
          // Al abrir, la hoja sube y "asienta" con un leve overshoot (curva compartida
          // --ease-settle), como que rebota al apoyarse arriba. Sin overshoot al arrastrar
          // (dragging → sin transición) para que el drag siga al dedo 1:1.
          transition: dragging ? "none" : "transform 0.4s var(--ease-settle), opacity 0.3s ease",
          willChange: "transform", userSelect: "none" as const,
          WebkitUserSelect: "none" as const, WebkitTouchCallout: "none" as const,
        }),
      }}>
        <div {...(isDesktop ? {} : { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp })}
          style={{ padding: isDesktop ? "18px 20px 0" : "4px 16px 0", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1, cursor: isDesktop ? "default" : dragging ? "grabbing" : "grab", touchAction: isDesktop ? "auto" : "none" }}>
          {/* El handle es la afordancia del arrastre: sin arrastre, no va. */}
          {!isDesktop && (
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 12px" }}>
              <div style={{ width: 42, height: 5, background: "var(--border)", borderRadius: 99 }} />
            </div>
          )}
          {title !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 12px", marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
              <button data-close onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>
          )}
        </div>
        <div ref={contentRef} style={{ padding: isDesktop ? "0 20px 24px" : "0 16px 40px" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
