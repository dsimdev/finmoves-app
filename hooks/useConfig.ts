"use client";

import { useEffect, useState, useCallback } from "react";
import { ConfigUsuario } from "@/types";
import { obtenerConfig } from "@/services/firebase/config";

const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function configCacheKey(uid: string) { return `config_${uid}`; }

export function saveConfigCache(uid: string, config: ConfigUsuario) {
  try {
    localStorage.setItem(configCacheKey(uid), JSON.stringify({ ts: Date.now(), data: config }));
  } catch {}
}

function loadConfigCache(uid: string): ConfigUsuario | null {
  try {
    const raw = localStorage.getItem(configCacheKey(uid));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: ConfigUsuario };
    if (Date.now() - ts > CONFIG_CACHE_TTL) return null;
    return data as ConfigUsuario;
  } catch { return null; }
}

export function useConfig(userId: string | undefined) {
  const [config, setConfig] = useState<ConfigUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Parche optimista de campos de meta en el config EN MEMORIA (y en el cache), sin re-leer
  // Firestore. Lo usan cosas que escriben meta y necesitan que el resto de la app lo vea ya
  // (ej. descartar un hint: si no, al cambiar de tab el config viejo lo re-muestra).
  const patchMeta = useCallback((patch: Partial<ConfigUsuario["meta"]>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, meta: { ...prev.meta, ...patch } };
      if (userId) saveConfigCache(userId, next);
      return next;
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const isExplicitRefresh = version > 0;

    let cancelado = false;

    const fetch = async () => {
      // Carga inicial: mostrar el cache YA (rápido, sin parpadeo) pero SIEMPRE revalidar contra
      // el servidor en segundo plano. Antes se usaba el cache y se hacía `return` sin verificar:
      // si config cambiaba en otro dispositivo o por un script (ej. movsRevision, categorías),
      // la app no se enteraba hasta un refresh explícito → los movimientos no se re-sincronizaban.
      if (!isExplicitRefresh) {
        const cached = loadConfigCache(userId);
        if (cached) {
          setConfig(cached);
          setLoading(false);
        }
      }

      try {
        const data = await obtenerConfig(userId);
        if (cancelado) return;
        // Actualizar solo si el server difiere del estado ACTUAL (no del cache que mostramos):
        // así un patchMeta optimista que haya ocurrido mientras llegaba el fetch NO se pisa si
        // el server todavía no lo refleja. Comparación por JSON → sin re-render si no cambió.
        setConfig((actual) => {
          if (actual && JSON.stringify(actual) === JSON.stringify(data)) return actual;
          saveConfigCache(userId, data);
          return data;
        });
      } catch (err) {
        console.error("Error fetching config:", err);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    fetch();
    return () => { cancelado = true; };
  }, [userId, version]);

  return { config, loading, refresh, patchMeta };
}
