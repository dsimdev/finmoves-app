"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "./useAuth";

// True cuando el último intento de sync a Sheets falló (error más reciente que el
// último éxito). Solo aplica al owner (es el único con sync a Sheets).
//
// Antes usaba onSnapshot (listener en tiempo real), y como BottomNav/SideNav están
// montados toda la sesión, mantenía una conexión Firestore viva permanentemente →
// batería. El estado de sync sólo cambia unas pocas veces por día (cron), así que
// alcanza con leerlo al montar y al volver a la app (visibilitychange). Sin listener,
// Firestore puede quedar idle cuando no se está leyendo.
export function useSyncError(): boolean {
  const { user } = useAuth();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
    // Sin usuario/no-owner: nada que chequear. No hace falta setHasError(false) acá — el
    // estado inicial ya es false, y si el usuario cambia de owner a no-owner en la misma
    // sesión, vuelve a false solo (useState no persiste entre remontados de otro usuario).
    if (!user?.uid || !isOwner) return;

    const ref = doc(db, `users/${user.uid}/config/syncMeta`);
    let cancelled = false;
    const check = async () => {
      try {
        const d = (await getDoc(ref)).data();
        if (cancelled) return;
        if (!d?.lastError) { setHasError(false); return; }
        const errAt = d.lastError?.at?.toDate?.()?.getTime?.() ?? 0;
        const syncAt = d.lastSync?.toDate?.()?.getTime?.() ?? 0;
        setHasError(errAt > syncAt);
      } catch { if (!cancelled) setHasError(false); }
    };
    check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); };
  }, [user?.uid, user?.email]);

  return hasError;
}
