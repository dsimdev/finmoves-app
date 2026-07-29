"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useConfig } from "@/hooks/useConfig";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { listarRecurrentes, type Recurrente } from "@/services/firebase/recurrentes";
import { listarPlantillas, type Plantilla } from "@/services/firebase/plantillas";
import { syncPushSubscription } from "@/lib/push-client";
import { useMetaHitos } from "@/hooks/useMetaHitos";
import { useNotifCatchUp } from "@/hooks/useNotifCatchUp";
import { useCotizacion } from "@/hooks/useCotizacion";
import { agruparPorPeriodo } from "@/utils/periodo";
import { MetaCelebration } from "@/components/investments/MetaCelebration";
import type { Movimiento, ConfigUsuario } from "@/types";

interface DataCtx {
  movimientos: Movimiento[];
  loading: boolean;
  refresh: () => void;
  updateMovimiento: (id: string, patch: Partial<Movimiento>) => void;
  removeMovimiento: (id: string) => void;
  prependMovimiento: (movs: Movimiento[]) => void;
  config: ConfigUsuario | null;
  configLoading: boolean;
  refreshConfig: () => void;
  patchConfigMeta: (patch: Partial<ConfigUsuario["meta"]>) => void;
  recurrentes: Recurrente[];
  recurrentesLoaded: boolean;
  plantillas: Plantilla[];
  refreshRecurrentes: () => void;
  refreshPlantillas: () => void;
  mutateRecurrentes: React.Dispatch<React.SetStateAction<Recurrente[]>>;
  mutatePlantillas: React.Dispatch<React.SetStateAction<Plantilla[]>>;
}

const Ctx = createContext<DataCtx | null>(null);

// Una única instancia de movimientos + config para todas las pestañas.
// Vive en el layout de tabs (que NO se desmonta al navegar entre pestañas),
// así se lee una sola vez por sesión en lugar de re-fetchear en cada montaje.
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const { config, loading: configLoading, refresh: refreshConfig, patchMeta: patchConfigMeta } = useConfig(user?.uid);
  // La revision (config/meta.movsRevision) le dice al hook de movimientos si hubo cambios
  // en otro dispositivo que no alteran el count (ediciones puras) → fuerza re-fetch.
  const { movimientos, loading, refresh, updateLocal, removeLocal, prependLocal } = useAllMovimientos(user?.uid, config?.meta.movsRevision ?? 0);
  const hydratePrefs = useAppPrefs((s) => s.hydrate);

  // Recurrentes y plantillas: se leen una vez por sesión (antes se re-leían en cada
  // visita a Movimientos y en cada apertura del modal de alta, respectivamente).
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  // `loaded` distingue "todavía no llegó" de "no hay ninguno": el deep-link ?recurrente=
  // lo necesita para saber si el template no existe (borrado) o si solo falta esperar.
  const [recurrentesLoaded, setRecurrentesLoaded] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const uid = user?.uid;
  useEffect(() => {
    // Limpieza real, no redundante: si un usuario cierra sesión y otro entra en el mismo tab
    // (sin remount), hay que descartar los recurrentes/plantillas del usuario anterior — el
    // estado inicial en [] solo cubre el primer montaje.
    if (!uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecurrentes([]); setRecurrentesLoaded(false); setPlantillas([]);
      return;
    }
    listarRecurrentes(uid).then((r) => { setRecurrentes(r); setRecurrentesLoaded(true); }).catch(() => {});
    listarPlantillas(uid).then(setPlantillas).catch(() => {});
  }, [uid]);
  const refreshRecurrentes = useCallback(() => { if (uid) listarRecurrentes(uid).then(setRecurrentes).catch(() => {}); }, [uid]);
  const refreshPlantillas = useCallback(() => { if (uid) listarPlantillas(uid).then(setPlantillas).catch(() => {}); }, [uid]);

  // Auto-reparación de la suscripción push (item B): 1×/sesión, re-registra este device
  // si su sub local no está en Firestore. Best-effort, no bloquea nada.
  useEffect(() => {
    if (uid) syncPushSubscription(uid).catch(() => {});
  }, [uid]);

  // Prefs por-usuario: la config (Firestore) es la fuente de verdad. Al cargarla,
  // hidratamos el store local para no arrastrar prefs de otro usuario del dispositivo.
  useEffect(() => {
    if (!config) return;
    // showAhorros = toggle del usuario ("mostrar la tab Inversión"). Si lo apaga, la tab
    // sale del navbar. La meta propia es para todos; la reserva FX (patrimonio, saldo,
    // meta FX, historial) se gatea aparte por permiso de inversión + moneda ARS.
    hydratePrefs({
      monedaPrincipal: config.meta.monedaPrincipal,
      monedaInversiones: config.meta.monedaInversiones,
      showAhorros: config.meta.showAhorros ?? false,
      showReportes: config.meta.showReportes,
    });
  }, [config, hydratePrefs]);

  // Usuario nuevo sin onboarding completado → al wizard.
  useEffect(() => {
    if (config && config.meta.onboardingCompleto === false) router.replace("/onboarding");
  }, [config, router]);

  // Hitos de meta (50/75/100%): se festejan acá, en el momento en que la carga mueve el
  // acumulado. Reemplazan al push del cron, que llegaba después de que el usuario ya lo vio.
  const { festejo, cerrarFestejo } = useMetaHitos(uid, movimientos, config, patchConfigMeta);

  // Campana al día: el cron corre cada varias horas, así que al abrir la app puede haber
  // cosas ya ocurridas (el dólar se movió, un gasto disparó el desvío) todavía sin registrar.
  // Se anotan en la bandeja sin mandar push y sin tocar el baseline del cron.
  const { cotizacion } = useCotizacion();
  const periodosAgrupados = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const periodoActualId = periodosAgrupados[0]?.periodoId;
  const periodoCerrado = periodosAgrupados[1]?.periodoId ?? null;
  useNotifCatchUp({
    uid,
    movimientos,
    config,
    recurrentes,
    listo: !loading && !configLoading && recurrentesLoaded,
    dolarOficial: cotizacion?.oficial ?? null,
    periodoActualId,
    periodoCerrado,
  });

  return (
    <Ctx.Provider value={{ movimientos, loading, refresh, updateMovimiento: updateLocal, removeMovimiento: removeLocal, prependMovimiento: prependLocal, config, configLoading, refreshConfig, patchConfigMeta, recurrentes, recurrentesLoaded, plantillas, refreshRecurrentes, refreshPlantillas, mutateRecurrentes: setRecurrentes, mutatePlantillas: setPlantillas }}>
      {children}
      {festejo && <MetaCelebration key={festejo.key} hito={festejo.hito} onDone={cerrarFestejo} />}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData debe usarse dentro de <DataProvider>");
  return c;
}
