"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMoney } from "@/hooks/useHideValues";
import { useData } from "@/app/(tabs)/data-context";
import { fechaAPeriodoId } from "@/utils/periodo";
import { MovementAdd } from "./MovementAdd";
import { MovementDetail } from "./MovementEditDetail";
import { MovementDelete } from "./MovementDelete";
import { Movimiento, ConfigUsuario } from "@/types";

interface MovementModalProps {
  open: boolean;
  mode: "add" | "edit";
  movimiento?: Movimiento | null;
  /** Movimientos del usuario (para derivar períodos/serie). */
  movimientos: Movimiento[];
  /** Config del usuario (provista por el padre desde DataProvider, sin re-leer). */
  config: ConfigUsuario | null;
  /** Período al que se carga el alta. Por defecto, el más reciente. */
  activePeriodoId?: string;
  /** Vista inicial en edición: "delete" abre directo la confirmación de borrado (long-press). */
  initialView?: "form" | "delete";
  /** Alta pre-cargada (desde un recurrente): completa tipo/categoría/descripción/observación; el monto queda vacío. */
  prefill?: { tipo?: "Gasto" | "Ingreso"; categoria?: string; descripcion?: string; observaciones?: string } | null;
  /** Modo reserva (abierto desde Inversión): solo carga +Reserva / -Reserva (FX). */
  reserveMode?: boolean;
  /** Solo lectura (detalle desde el historial de Inversión): muestra el detalle sin editar. */
  readOnly?: boolean;
  onClose: () => void;
  /** Fallback para casos sin handler específico. */
  onChanged: () => void;
  /** Alta optimista: recibe los movimientos creados con su ID definitivo. */
  onCreated?: (movs: Movimiento[]) => void;
  /** Actualización optimista al editar/borrar. */
  onUpdated?: (id: string, patch: Partial<Movimiento>) => void;
  onDeleted?: (id: string) => void;
}

// Modal de alta/edición/borrado de movimientos, reutilizable (Movimientos, Inicio). Cascarón
// delgado: decide A CUÁL de los 3 hijos por vista mostrar (MovementAdd, MovementDetail,
// MovementDelete) y calcula lo transversal (auth, isOwner). El resto de la lógica vive en
// cada hijo — ver plan de split en el historial de commits de esta rama.
export function MovementModal({ open, mode, movimiento, movimientos, config, activePeriodoId, initialView, prefill, reserveMode, readOnly, onClose, onChanged, onCreated, onUpdated, onDeleted }: MovementModalProps) {
  const { user } = useAuth();
  const { m: money } = useMoney();
  const { recurrentes } = useData();
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;

  // "editDetail" = detalle/edición (MovementDetail decide la sub-vista); "delete" =
  // confirmación de borrado. Solo distingue lo que este padre necesita para elegir A CUÁL
  // de los 2 hijos mostrar; detail↔form es interno a MovementDetail (vía su initialView).
  const [view, setView] = useState<"editDetail" | "delete">("editDetail");

  // Inicializar edición/borrado al abrir: solo decide A CUÁL hijo mostrar (editDetail vs
  // delete). El resto (repoblar campos, sub-vista detail/form) vive en MovementDetail.
  useEffect(() => {
    if (!open || mode !== "edit" || !movimiento) return;
    // El sueldo que abre período (ancla) no se puede borrar → nunca abrir en "delete".
    const esAncla = movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo" &&
      fechaAPeriodoId(movimiento.fecha) === movimiento.periodoId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con la prop `open`/`initialView` (a qué hijo mostrar al abrir), no deriva de otro estado calculable en render
    setView(initialView === "delete" && !esAncla ? "delete" : "editDetail");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo movimiento?.id importa (no el objeto entero, que puede cambiar de referencia en cada render del padre externo)
  }, [open, mode, movimiento?.id, initialView]);

  return (
    <>
      {mode === "add" && !readOnly && (
        <MovementAdd
          open={open} movimientos={movimientos} config={config} activePeriodoId={activePeriodoId}
          prefill={prefill} reserveMode={reserveMode} onClose={onClose} onChanged={onChanged}
          onCreated={onCreated} onUpdated={onUpdated} onDeleted={onDeleted}
        />
      )}

      {mode === "edit" && movimiento && !readOnly && (
        <MovementDetail
          open={open && view === "editDetail"} movimiento={movimiento} config={config}
          recurrentes={recurrentes} money={money} uid={user?.uid} isOwner={isOwner}
          initialView={initialView === "form" ? "form" : "detail"}
          onClose={onClose} onUpdated={onUpdated} onChanged={onChanged}
        />
      )}
      {readOnly && movimiento && (
        <MovementDetail
          open={open} movimiento={movimiento} config={config}
          recurrentes={recurrentes} money={money} readOnly onClose={onClose} onChanged={onChanged}
        />
      )}
      {movimiento && (
        <MovementDelete
          open={open && view === "delete"} movimiento={movimiento} uid={user?.uid}
          entradaDirecta={initialView === "delete"} money={money} onClose={onClose}
          onBackToDetail={() => setView("editDetail")} onDeleted={onDeleted} onChanged={onChanged}
        />
      )}
    </>
  );
}
