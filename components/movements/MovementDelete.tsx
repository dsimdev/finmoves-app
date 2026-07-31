"use client";

import { useState } from "react";
import { useT } from "@/hooks/useTranslation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { eliminarMovimiento } from "@/services/firebase/movimientos";
import { deleteComprobante } from "@/lib/storage";
import type { Movimiento } from "@/types";

// Confirmación de borrado de un movimiento. Se llega por swipe/long-press en la lista
// (directo) o desde el detalle (tap en el tachito) — `onCancel` distingue los dos casos:
// sin detalle detrás, cancelar cierra todo; con detalle detrás, cancelar vuelve a él.
//
// Tiene su PROPIO loading/error (no comparte con Edición): antes vivían en el mismo par de
// estados del padre porque nunca se disparan a la vez (view solo puede ser una cosa), pero
// acoplar el nombre de un estado a dos componentes distintos es la clase de deuda que este
// split busca sacar. El costo (2 useState en vez de 0) es mínimo.

export interface MovementDeleteProps {
  open: boolean;
  movimiento: Movimiento;
  uid: string | undefined;
  /** true si se entró directo a borrar (swipe/long-press): sin detalle detrás, cancelar cierra. */
  entradaDirecta: boolean;
  money: (n: number) => string;
  onClose: () => void;
  /** Volver al detalle (cuando NO fue entrada directa). */
  onBackToDetail: () => void;
  onDeleted?: (id: string) => void;
  onChanged: () => void;
}

export function MovementDelete({ open, movimiento, uid, entradaDirecta, money, onClose, onBackToDetail, onDeleted, onChanged }: MovementDeleteProps) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!uid) return;
    setLoading(true); setError("");
    try {
      await eliminarMovimiento(uid, movimiento.id);
      await deleteComprobante(movimiento.comprobantePath); // borrar el comprobante asociado
      if (onDeleted) onDeleted(movimiento.id); else onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t.unexpectedError);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)" loading={loading}
      onConfirm={handleDelete} onCancel={entradaDirecta ? onClose : () => { setError(""); onBackToDetail(); }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 6 }}>{t.deleteMovementTitle}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{movimiento.descripcion || movimiento.categoria}</div>
        <div style={{ fontSize: 18, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 8 }}>{money(movimiento.monto)}</div>
        <div style={{ fontSize: 11 }}>{t.actionIrreversible}</div>
        {error && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 10, fontWeight: 600 }}>{error}</div>}
      </div>
    </ConfirmModal>
  );
}
