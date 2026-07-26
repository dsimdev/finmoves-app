"use client";

import { useEffect, useRef } from "react";
import { notificacionesPendientes } from "@/utils/notif-inapp";
import { agregarNotificaciones, leerNotifyMeta, guardarNotifyMeta } from "@/services/firebase/notificaciones";
import { obtenerPresupuesto } from "@/services/firebase/presupuestos";
import { listarRecordatorios } from "@/services/firebase/recordatorios";
import { parsePeriodoId } from "@/utils/reportes";
import { fechaISO_AR } from "@/utils/fecha-ar";
import type { Movimiento, ConfigUsuario } from "@/types";
import type { Recurrente } from "@/services/firebase/recurrentes";

// Pone la campana al día cuando se abre la app. El cron corre cada varias horas: entre
// corridas el dólar se mueve y los gastos cambian el desvío del presupuesto, así que al
// entrar la bandeja está atrasada respecto de lo que ya pasó.
//
// NO manda push (interrumpir sigue siendo del cron) y NO toca su baseline: el dedup usa una
// marca propia del cliente. Corre UNA vez por sesión, cuando los datos ya cargaron.

export function useNotifCatchUp({ uid, movimientos, config, recurrentes, listo, dolarOficial, periodoActualId, periodoCerrado, onNuevas }: {
  uid: string | undefined;
  movimientos: Movimiento[];
  config: ConfigUsuario | null;
  recurrentes: Recurrente[];
  /** true cuando movimientos/config/recurrentes ya cargaron (si no, se evaluaría en vacío). */
  listo: boolean;
  dolarOficial: number | null;
  periodoActualId: string | undefined;
  /** periodoId del período que cerró (para el aviso de recap), o null. */
  periodoCerrado: string | null;
  /** Se llama si se anotó algo, para refrescar el badge de la campana. */
  onNuevas?: () => void;
}) {
  const yaCorrio = useRef(false);

  useEffect(() => {
    if (!uid || !listo || yaCorrio.current) return;
    yaCorrio.current = true;

    (async () => {
      try {
        const [{ inApp: meta, budgetAvisos }, recordatorios, presupuestoOverride] = await Promise.all([
          leerNotifyMeta(uid),
          listarRecordatorios(uid).catch(() => []),
          periodoActualId ? obtenerPresupuesto(uid, periodoActualId).catch(() => null) : Promise.resolve(null),
        ]);

        const periodoMovs = periodoActualId ? movimientos.filter((m) => m.periodoId === periodoActualId) : [];
        const dias = periodoActualId
          ? Math.max(1, Math.floor((Date.now() - parsePeriodoId(periodoActualId).getTime()) / 86_400_000) + 1)
          : 0;
        const hoy = fechaISO_AR();

        const { nuevas, meta: metaNueva, budgetAvisos: budgetNuevo } = notificacionesPendientes({
          meta,
          budgetAvisos,
          dolarOficial,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
          movimientos,
          config,
          recurrentes,
          recordatorios,
          presupuesto: presupuestoOverride ?? config?.meta.presupuestoTemplate ?? {},
          periodoActual: periodoActualId ? { periodoId: periodoActualId, movimientos: periodoMovs } : null,
          periodoCerrado,
          diasTranscurridos: dias,
          hoy,
        });

        // La marca se guarda aunque no haya nada nuevo: la primera corrida ancla los
        // baselines (dólar, versión) para no avisar de golpe por todo el historial.
        const metaCambio = JSON.stringify(meta) !== JSON.stringify(metaNueva);
        if (nuevas.length > 0) {
          await agregarNotificaciones(uid, nuevas);
          onNuevas?.();
        }
        // budgetAvisos se comparte con el cron: se escribe en su mismo campo.
        if (metaCambio || budgetNuevo) await guardarNotifyMeta(uid, metaNueva, budgetNuevo);
      } catch (e) {
        console.error("[notif-catchup]", e);
      }
    })();
  }, [uid, listo, movimientos, config, recurrentes, dolarOficial, periodoActualId, onNuevas]);
}
