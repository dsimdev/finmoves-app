"use client";

import { useState } from "react";
import { useT } from "@/hooks/useTranslation";
import { CenterCard } from "@/components/ui/CenterCard";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { fechaCorta } from "@/utils/periodo";
import { recurrentKey } from "@/utils/recurrent-key";
import {
  DetalleHero, DetalleFX, DetalleTextos, ComprobanteButton,
  IconoCalendario, IconoTarjeta, IconoRecurrente, detalleChip,
} from "./movement-shared";
import { Movimiento, ConfigUsuario } from "@/types";
import type { Recurrente } from "@/services/firebase/recurrentes";

// Detalle (solo lectura) + vista de Reserva (readOnly, desde Inversión) de un movimiento
// existente. Editar/eliminar son gestos de swipe en la lista, no acciones de esta card —
// así no repite acciones ni reintroduce el flujo de borrado-desde-detalle (que traía el bug
// del cancelar, ver commit histórico).
//
// `view` es interno a este componente ("detail" | "form"): el padre (MovementModal) solo
// necesita saber SI está abierto, no en qué sub-vista. Cuando se agregue Edición acá mismo,
// "form" pasa a mostrar la CenterCard de edición en vez de la de detalle.

export interface MovementDetailProps {
  open: boolean;
  movimiento: Movimiento;
  config: ConfigUsuario | null;
  recurrentes: Recurrente[];
  money: (n: number) => string;
  /** Solo lectura (reserva desde Inversión): sin chip de medio de pago, el héroe muestra la
   *  cantidad de divisa en vez del monto en pesos. */
  readOnly?: boolean;
  onClose: () => void;
}

/** Ícono/color/nombre de la categoría del movimiento, o solo el nombre si no está en config
 *  (categoría borrada, o Move/RESTO que no son categorías reales de usuario). */
function catDelMovimiento(movimiento: Movimiento, config: ConfigUsuario | null) {
  return config?.categorias.find((c) => c.nombre === movimiento.categoria) ?? { nombre: movimiento.categoria };
}

export function MovementDetail({ open, movimiento, config, recurrentes, money, readOnly, onClose }: MovementDetailProps) {
  const t = useT();
  const [viewer, setViewer] = useState<{ src: string; isPdf: boolean } | null>(null);

  const isLocked = movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo";
  const esRec = recurrentes.some((r) => r.activo &&
    recurrentKey(r) === recurrentKey({ tipo: movimiento.tipo, categoria: movimiento.categoria, descripcion: movimiento.descripcion, observaciones: movimiento.observaciones }));

  return (
    <>
      {!readOnly ? (
        <CenterCard open={open} onClose={onClose} title={t.detail}>
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
        // entró/salió, no los pesos.
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
      {viewer && <MediaViewer src={viewer.src} isPdf={viewer.isPdf} onClose={() => setViewer(null)} />}
    </>
  );
}
