"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";
import { useMounted } from "@/hooks/useMounted";
import { SwipeAway } from "@/components/ui/SwipeAway";
import { listarNotificaciones, marcarLeida, eliminarNotificacion, marcarTodasLeidas, type Notificacion, type NotifTipo } from "@/services/firebase/notificaciones";

// Ícono + color por tipo de notificación.
const META: Record<NotifTipo, { color: string; icon: ReactNode }> = {
  dolar: { color: "var(--yellow)", icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
  version: { color: "var(--blue)", icon: <><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></> },
  recurrente: { color: "var(--purple)", icon: <><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></> },
  sueldo: { color: "var(--green)", icon: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></> },
  carga: { color: "var(--teal)", icon: <><path d="M12 5v14M5 12h14" /></> },
  meta: { color: "var(--green)", icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.5" /></> },
  recordatorio: { color: "var(--blue)", icon: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></> },
  permiso: { color: "var(--teal)", icon: <><path d="M9 12l2 2 4-4" /><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" /></> },
  sync: { color: "var(--blue)", icon: <><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></> },
  baja: { color: "var(--red)", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
  wrapped: { color: "var(--green)", icon: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></> },
  presupuesto: { color: "var(--red)", icon: <><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="4" width="3" height="14" /></> },
};

const hace = (ms: number): string => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "recién";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `hace ${d} d`;
  return new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

// Fila con swipe a la izquierda → tacho para eliminar (SwipeToDelete). Tap → abre.
// Fila de la bandeja. El cuerpo se muestra en UNA línea: el primer tap despliega el detalle
// completo acá mismo y el segundo navega al destino. Así una notificación que resume varias
// cosas ("6 categorías ya se pasaron") se puede abrir sin salir de la campana.
function Row({ n, onOpen, onDelete, deleteLabel, tapLabel }: { n: Notificacion; onOpen: () => void; onDelete: () => void; deleteLabel: string; tapLabel: string }) {
  const meta = META[n.tipo] ?? META.recordatorio;
  const [abierta, setAbierta] = useState(false);

  return (
    <SwipeAway onDelete={onDelete} deleteLabel={deleteLabel} radius={12}>
      <button
        onClick={() => (abierta ? onOpen() : setAbierta(true))}
        style={{
          width: "100%", display: "flex", alignItems: "flex-start", gap: 11, textAlign: "left", cursor: "pointer",
          padding: "12px 13px", borderRadius: 12, border: "1px solid var(--border)",
          background: n.leida ? "var(--surface)" : "var(--surface-alt)",
        }}
      >
        <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)` }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</span>
            {!n.leida && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
          </span>
          {/* Cerrada: una línea. Abierta: el cuerpo completo + el desglose si lo hay. */}
          <span style={{
            display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.4,
            ...(abierta ? {} : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
          }}>{n.body}</span>
          {abierta && n.detalle && (
            <span style={{ display: "block", fontSize: 11.5, color: "var(--text)", marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-line" }}>{n.detalle}</span>
          )}
          <span style={{ display: "block", fontSize: 10, color: "var(--muted)", marginTop: 4, opacity: 0.75 }}>
            {hace(n.createdAt)}{abierta ? ` · ${tapLabel}` : ""}
          </span>
        </span>
      </button>
    </SwipeAway>
  );
}

export function NotificationsBell() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);
  // El popover se ancla a la campana real: los headers no miden todos igual (el de Inicio
  // lleva subtítulo y es más alto), así que un `top` fijo lo dejaba pegado al ícono ahí.
  const btnRef = useRef<HTMLButtonElement>(null);

  const cargar = useCallback(() => {
    if (!user?.uid) return;
    listarNotificaciones(user.uid).then(setItems).catch(() => {});
  }, [user]);

  // Lectura única al montar (por batería, como el resto de la app). Se refresca al abrir.
  useEffect(() => { cargar(); }, [cargar]);

  const noLeidas = items.filter((n) => !n.leida).length;

  const abrirNotif = async (n: Notificacion) => {
    if (user?.uid && !n.leida) { marcarLeida(user.uid, n.id).catch(() => {}); setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, leida: true } : x)); }
    setOpen(false);
    router.push(n.dest);
  };
  const eliminar = async (n: Notificacion) => {
    if (user?.uid) eliminarNotificacion(user.uid, n.id).catch(() => {});
    setItems((prev) => prev.filter((x) => x.id !== n.id));
  };
  const limpiarTodas = async () => {
    if (!user?.uid) return;
    const ids = items.filter((n) => !n.leida).map((n) => n.id);
    marcarTodasLeidas(user.uid, ids).catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
  };

  return (
    <>
      <button ref={btnRef} onClick={() => { setOpen(true); cargar(); }} aria-label={t.notifications} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: open ? "var(--accent)" : "var(--muted)", padding: 4, display: "flex" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {noLeidas > 0 && (
          <span style={{ position: "absolute", top: 0, right: 0, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{noLeidas > 9 ? "9+" : noLeidas}</span>
        )}
      </button>

      <NotifPopover open={open} onClose={() => setOpen(false)} title={t.notifications} anchorRef={btnRef}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "28px 0" }}>{t.notificationsEmpty}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {noLeidas > 0 && (
              <button onClick={limpiarTodas} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 2px 2px" }}>{t.markAllRead}</button>
            )}
            {items.map((n) => (
              <Row key={n.id} n={n} onOpen={() => abrirNotif(n)} onDelete={() => eliminar(n)} deleteLabel={t.delete} tapLabel={t.tapToOpen} />
            ))}
            <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 4, opacity: 0.7 }}>{t.notificationsSlideHint}</div>
          </div>
        )}
      </NotifPopover>
    </>
  );
}

// Popover anclado bajo la campana (esquina superior derecha): se despliega desde ahí,
// no ocupa toda la pantalla. Overlay transparente para cerrar al tocar afuera; portal
// para escapar el stacking del header. Bloquea el scroll de fondo mientras está abierto.
function NotifPopover({ open, onClose, title, children, anchorRef }: { open: boolean; onClose: () => void; title: string; children: ReactNode; anchorRef?: React.RefObject<HTMLElement | null> }) {
  const mounted = useMounted();
  // Distancia desde arriba: se mide del botón que lo abre, así queda a la misma distancia
  // del ícono en cualquier pantalla (el header de Inicio es más alto por el subtítulo).
  const [top, setTop] = useState<number | null>(null);
  useScrollLock(open);
  useModalBack(open, onClose);
  useEffect(() => {
    if (!open) return;
    const r = anchorRef?.current?.getBoundingClientRect();
    if (r) setTop(r.bottom + 8); // 8px de aire bajo el ícono
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, anchorRef]);
  if (!mounted || !open) return null;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div
        data-notif-pop
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", right: 12,
          // Medido del ícono; el calc es el fallback si todavía no hay medición.
          top: top ?? "calc(env(safe-area-inset-top, 0px) + 54px)",
          width: "min(360px, calc(100vw - 24px))", maxHeight: "70vh", overflowY: "auto",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
          boxShadow: "0 14px 44px rgba(0,0,0,0.5)", transformOrigin: "top right",
          animation: "appearPopover var(--open-dur) var(--ease-out)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 8px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>{title}</span>
          <button onClick={onClose} aria-label="×" style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 4, margin: -4 }}>×</button>
        </div>
        <div style={{ padding: "0 14px 14px" }}>{children}</div>
      </div>
      <style>{`
        @media (prefers-reduced-motion: reduce) { [data-notif-pop] { animation: none !important } }
      `}</style>
    </div>,
    document.body
  );
}
