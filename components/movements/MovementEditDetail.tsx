"use client";

import { useEffect, useState } from "react";
import { useT } from "@/hooks/useTranslation";
import { CenterCard } from "@/components/ui/CenterCard";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { Loader } from "@/components/ui/Loader";
import { fechaCorta } from "@/utils/periodo";
import { recurrentKey } from "@/utils/recurrent-key";
import { actualizarMovimiento } from "@/services/firebase/movimientos";
import { uploadComprobante, deleteComprobante } from "@/lib/storage";
import {
  DetalleHero, DetalleFX, DetalleTextos, ComprobanteButton, ComprobanteField,
  IconoCalendario, IconoTarjeta, IconoRecurrente, detalleChip, esMovimientoFX, monedaMovFX,
} from "./movement-shared";
import { Movimiento, ConfigUsuario } from "@/types";
import type { Recurrente } from "@/services/firebase/recurrentes";

// Detalle (solo lectura) + Edición + vista de Reserva (readOnly, desde Inversión) de un
// movimiento existente. Tap en la fila abre el detalle; editar/eliminar son gestos de swipe
// en la lista (initialView="form"/"delete" en el padre) — así el detalle no repite acciones
// y desaparece el flujo de borrado-desde-detalle (que traía el bug del cancelar).
//
// `view` es interno a este componente ("detail" | "form"): el padre (MovementModal) solo
// necesita saber SI está abierto y, para el caso de edición directa, initialView.

export interface MovementDetailProps {
  open: boolean;
  movimiento: Movimiento;
  config: ConfigUsuario | null;
  recurrentes: Recurrente[];
  money: (n: number) => string;
  /** uid del usuario logueado. Requerido para editar; sin esto (o en readOnly) no se ofrece. */
  uid?: string;
  /** Dueño de la app: puede adjuntar comprobantes siempre (ver permisos/comprobantes). */
  isOwner?: boolean;
  /** "form" abre directo en edición (lapicito de swipe en la lista), sin pasar por el
   *  detalle. Por defecto entra a "detail" (tap en la fila). */
  initialView?: "detail" | "form";
  /** Solo lectura (reserva desde Inversión): sin chip de medio de pago, el héroe muestra la
   *  cantidad de divisa en vez del monto en pesos, y no ofrece editar. */
  readOnly?: boolean;
  onClose: () => void;
  /** Actualización optimista al editar (fallback: onChanged). */
  onUpdated?: (id: string, patch: Partial<Movimiento>) => void;
  onChanged: () => void;
}

/** Ícono/color/nombre de la categoría del movimiento, o solo el nombre si no está en config
 *  (categoría borrada, o Move/RESTO que no son categorías reales de usuario). */
function catDelMovimiento(movimiento: Movimiento, config: ConfigUsuario | null) {
  return config?.categorias.find((c) => c.nombre === movimiento.categoria) ?? { nombre: movimiento.categoria };
}

export function MovementDetail({ open, movimiento, config, recurrentes, money, uid, isOwner, initialView, readOnly, onClose, onUpdated, onChanged }: MovementDetailProps) {
  const t = useT();
  const [viewer, setViewer] = useState<{ src: string; isPdf: boolean } | null>(null);
  // "detail" (tap en la fila) o "form" directo (lapicito de swipe en la lista, vía
  // initialView). Se resincroniza cada vez que se abre: el padre mantiene una sola instancia
  // de este componente entre movimientos distintos, así que el useState inicial no alcanza
  // (mismo motivo que el efecto de inicialización que tenía el modal viejo).
  const [view, setView] = useState<"detail" | "form">(initialView === "form" ? "form" : "detail");

  const isLocked = movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo";
  // Ahorros: el "texto" del movimiento es un origen de una lista cerrada (config.origenesAhorro),
  // no descripción libre — igual que en Alta. Antes la edición lo trataba como texto libre y
  // siempre lo guardaba en `descripcion` (nunca en `origenAhorro`), dejando entrar cualquier
  // valor y sin tocar el campo real.
  const esAhorros = movimiento.tipo === "Ingreso" && movimiento.categoria === "Ahorros";
  const esRec = recurrentes.some((r) => r.activo &&
    recurrentKey(r) === recurrentKey({ tipo: movimiento.tipo, categoria: movimiento.categoria, descripcion: movimiento.descripcion, observaciones: movimiento.observaciones }));
  const esFXMov = esMovimientoFX(movimiento);
  const fxMovLabel = monedaMovFX(movimiento);
  const canComprobante = !!isOwner || config?.meta.permisos?.comprobantes === true;
  const canEdit = !readOnly && !!uid;

  // ── Edit state ──
  const [eMonto, setEMonto] = useState(String(movimiento.monto));
  const [eDesc, setEDesc] = useState(movimiento.descripcion ?? "");
  const [eOrigen, setEOrigen] = useState((movimiento as Movimiento & { origenAhorro?: string }).origenAhorro ?? "");
  const [eMedio, setEMedio] = useState(movimiento.medioPago ?? "");
  const [eObs, setEObs] = useState(movimiento.observaciones ?? "");
  const [comprobante, setComprobante] = useState<{ file: File | null; removed: boolean }>({ file: null, removed: false });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con las props `open`/`initialView`/`movimiento` (repoblar al abrir), no deriva de otro estado calculable en render
    setView(initialView === "form" ? "form" : "detail");
    // Repoblar el form desde el movimiento actual (no desde la última edición): el padre
    // reusa esta MISMA instancia entre movimientos distintos, así que el useState inicial
    // de cada campo no alcanza.
    setEMonto(String(movimiento.monto));
    setEDesc(movimiento.descripcion ?? "");
    setEOrigen((movimiento as Movimiento & { origenAhorro?: string }).origenAhorro ?? "");
    setEMedio(movimiento.medioPago ?? "");
    setEObs(movimiento.observaciones ?? "");
    setEditError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe resincronizar al abrir/cambiar movimiento, no en cada cambio de initialView mientras está abierto (el usuario puede navegar detail↔form sin que el padre lo pise)
  }, [open, movimiento.id]);

  const isDirtyEdit =
    eMonto !== String(movimiento.monto) ||
    (esAhorros
      ? eOrigen !== ((movimiento as Movimiento & { origenAhorro?: string }).origenAhorro ?? "")
      : eDesc !== (movimiento.descripcion ?? "")) ||
    eMedio !== (movimiento.medioPago ?? "") ||
    eObs !== (movimiento.observaciones ?? "") ||
    !!comprobante.file || comprobante.removed;

  const handleEdit = async () => {
    if (!uid) return;
    setEditLoading(true); setEditError("");
    try {
      // Igual que el alta: sin esto, borrar el campo persiste NaN y rompe todos los KPIs.
      const montoEdit = parseFloat(eMonto);
      if (!montoEdit || montoEdit <= 0) throw new Error(t.errInvalidAmount);
      const update: Partial<Movimiento> = esAhorros
        ? { monto: montoEdit, observaciones: eObs, origenAhorro: eOrigen }
        : { monto: montoEdit, observaciones: eObs, descripcion: eDesc.trim() };
      if (!isLocked) update.medioPago = eMedio;
      if (canComprobante) {
        if (comprobante.file) {
          const up = await uploadComprobante(uid, comprobante.file);
          update.comprobanteUrl = up.url; update.comprobantePath = up.path;
          await deleteComprobante(movimiento.comprobantePath); // borrar el anterior
        } else if (comprobante.removed && movimiento.comprobanteUrl) {
          update.comprobanteUrl = ""; update.comprobantePath = "";
          await deleteComprobante(movimiento.comprobantePath);
        }
      }
      await actualizarMovimiento(uid, movimiento.id, update);
      // Optimista: parchear en memoria en vez de re-leer toda la colección.
      if (onUpdated) onUpdated(movimiento.id, update); else onChanged();
      onClose();
    } catch (err) { console.error(err); setEditError(err instanceof Error ? err.message : t.unexpectedError); }
    finally { setEditLoading(false); }
  };

  return (
    <>
      {!readOnly ? (
        <CenterCard open={open && view === "detail"} onClose={onClose} title={t.detail}>
          <DetalleHero movimiento={movimiento} money={money} categoria={catDelMovimiento(movimiento, config)}>
            <span style={detalleChip}><IconoCalendario />{fechaCorta(movimiento.fecha)}</span>
            {movimiento.medioPago && !isLocked && (
              <span style={detalleChip}><IconoTarjeta />{movimiento.medioPago}</span>
            )}
            {esRec && (
              <span style={{ ...detalleChip, color: "var(--accent)", background: "var(--accent-dim)", borderColor: "var(--accent)" }}>
                <IconoRecurrente />{t.recurrentMovement}
              </span>
            )}
          </DetalleHero>
          <DetalleFX movimiento={movimiento} labels={{ quantity: t.quantity, exchangeRate: t.exchangeRate }} />
          <DetalleTextos movimiento={movimiento} labels={{ description: t.description, notes: t.notes }} />
          <ComprobanteButton movimiento={movimiento} label={t.receipt} onOpen={(src, isPdf) => setViewer({ src, isPdf })} />
        </CenterCard>
      ) : (
        // RESERVA: mismo look de card, pero sin chip de medio de pago y con la cantidad de
        // divisa como héroe (fxComoHeroe) — en reserva el dato que importa es cuánta divisa
        // entró/salió, no los pesos. Sin acción de editar.
        <CenterCard open={open} onClose={onClose} title={t.detail}>
          <DetalleHero movimiento={movimiento} money={money} fxComoHeroe>
            <span style={detalleChip}><IconoCalendario />{fechaCorta(movimiento.fecha)}</span>
          </DetalleHero>
          {/* Cotización y observaciones en una fila; la descripción no se muestra porque en
              reserva siempre repite el título ("Compra USD"). */}
          <DetalleFX movimiento={movimiento} labels={{ quantity: t.quantity, exchangeRate: t.exchangeRate, notes: t.notes }} sinCantidad conObservaciones />
          <ComprobanteButton movimiento={movimiento} label={t.receipt} onOpen={(src, isPdf) => setViewer({ src, isPdf })} />
        </CenterCard>
      )}

      {/* EDICIÓN como CARD (mismo look que el detalle): "‹ Detalle" vuelve al detalle en la
          misma card. Antes era un BottomSheet separado. */}
      {canEdit && (
        <CenterCard open={open && view === "form"} onClose={onClose} title={t.editMovement}>
          <button type="button" onClick={() => { setEditError(""); setView("detail"); }} style={{
            display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12, padding: "4px 4px 4px 0",
            background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            {t.detail}
          </button>
          {esRec && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "9px 12px", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)", color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
              {t.recurrentMovement}
            </div>
          )}
          {/* Grid de 3: Tipo · Categoría · Fecha (solo lectura). */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {[{ l: t.type, v: movimiento.tipo }, { l: t.category, v: movimiento.categoria }, { l: t.date, v: fechaCorta(movimiento.fecha) }].map((f) => (
              <div key={f.l} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{f.l}</div>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.v}</div>
              </div>
            ))}
          </div>
          {/* Detalle de reserva (FX): cantidad + cotización, solo lectura. */}
          {esFXMov && (
            <div style={{ display: "grid", gridTemplateColumns: movimiento.cotizacion != null ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.quantity}</div>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fxMovLabel} {movimiento.cantidadUSD?.toFixed(2) ?? "—"}</div>
              </div>
              {movimiento.cotizacion != null && (
                <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.exchangeRate}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>${movimiento.cotizacion.toLocaleString("es-AR")}</div>
                </div>
              )}
            </div>
          )}
          {/* Monto (30%) + Descripción (70%) — ambos editables (descripción también en Sueldo).
              En Ahorros, la descripción es un ORIGEN de una lista cerrada (pills), no texto libre. */}
          <div style={{ display: "grid", gridTemplateColumns: esAhorros ? "1fr" : "30% 70%", gap: 10, marginBottom: 14 }}>
            <div>
              <div className="label">{t.amount}</div>
              <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" inputMode="decimal" value={eMonto} onChange={(e) => setEMonto(e.target.value)} />
            </div>
            {!esAhorros && (
              <div>
                <div className="label">{t.description}</div>
                <input className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
              </div>
            )}
          </div>
          {esAhorros && (
            <div style={{ marginBottom: 14 }}>
              <div className="label">{t.origin}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {(config?.origenesAhorro.filter((o) => o.activo || o.nombre === eOrigen) ?? []).map((o) => (
                  <button key={o.nombre} type="button" onClick={() => setEOrigen(o.nombre)}
                    className="pill" style={{
                      flexShrink: 0,
                      borderColor: eOrigen === o.nombre ? "var(--blue)" : "var(--border)",
                      background: eOrigen === o.nombre ? "var(--blue-dim)" : "transparent",
                      color: eOrigen === o.nombre ? "var(--blue)" : "var(--muted)",
                    }}>{o.nombre}</button>
                ))}
              </div>
            </div>
          )}
          {/* Medio de pago: no aplica al Sueldo (ancla del período). */}
          {!isLocked && (
            <div style={{ marginBottom: 14 }}>
              <div className="label">{t.paymentMethod}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {/* Misma lista que el alta (medios del usuario); el medio actual del
                    movimiento se muestra aunque esté desactivado, para no perderlo. */}
                {[...new Set([...(config?.mediosPago.filter((m) => m.activo).map((m) => m.nombre) ?? []), ...(eMedio ? [eMedio] : [])])].map((m) => (
                  <button key={m} type="button" onClick={() => setEMedio(m)} className="pill" style={{
                    borderColor: eMedio === m ? "var(--accent)" : "var(--border)",
                    background: eMedio === m ? "var(--accent-dim)" : "transparent",
                    color: eMedio === m ? "var(--accent)" : "var(--muted)",
                  }}>{m}</button>
                ))}
              </div>
            </div>
          )}
          {/* Observaciones (70%) + comprobante compacto (30%) en la misma fila */}
          <div style={{ display: "grid", gridTemplateColumns: canComprobante ? "70% 30%" : "1fr", gap: 10, alignItems: "end", marginBottom: 24 }}>
            <div>
              <div className="label">{t.notes}</div>
              <input className="input" value={eObs} onChange={(e) => setEObs(e.target.value)} />
            </div>
            {canComprobante && (
              <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
                <ComprobanteField existingUrl={movimiento.comprobanteUrl} resetKey={`${movimiento.id}-${view}`} onChange={setComprobante} />
              </div>
            )}
          </div>

          {editError && (
            <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 8, fontSize: 12, color: "var(--red)", textAlign: "center" }}>{editError}</div>
          )}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 56, marginTop: 8 }}>
            <button onClick={handleEdit} disabled={!isDirtyEdit || editLoading} aria-label={t.save} style={{
              width: 56, height: 56, borderRadius: "50%",
              background: isDirtyEdit ? "var(--green)" : "transparent",
              border: `2px solid ${isDirtyEdit ? "var(--green)" : "var(--border)"}`,
              color: isDirtyEdit ? "var(--bg)" : "var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isDirtyEdit ? "pointer" : "default",
              transition: "background 0.2s, border-color 0.2s, color 0.2s",
              boxShadow: isDirtyEdit ? "0 4px 20px var(--green)55" : "none",
              opacity: editLoading ? 0.5 : 1,
            }}>
              {editLoading
                ? <Loader size={20} />
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          </div>
        </CenterCard>
      )}

      {viewer && <MediaViewer src={viewer.src} isPdf={viewer.isPdf} onClose={() => setViewer(null)} />}
    </>
  );
}
