"use client";

import { useCallback } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "@/app/(tabs)/data-context";

// Hint contextual de gesto: se muestra hasta que el usuario lo descarta. El estado
// "ya visto" se guarda en Firestore (config/meta.hintsVistos) → sobrevive a reinstalar,
// a diferencia del viejo useFirstVisit (localStorage). La lectura es gratis: config/meta
// ya se lee 1×/sesión (DataProvider). El descarte es 1 escritura chica con merge.
export function useHint(key: string): [boolean, () => void] {
  const { user } = useAuth();
  const { config, configLoading, patchConfigMeta } = useData();

  const yaVisto = !!config?.meta.hintsVistos?.[key];
  // No mostrar mientras carga el config (evita el flash del hint que en realidad ya se vio).
  const show = !configLoading && !yaVisto;

  const dismiss = useCallback(() => {
    // Parche optimista del config EN MEMORIA (DataProvider persiste entre tabs): sin esto,
    // al cambiar de pestaña la pantalla se remonta con el config viejo y el hint REAPARECÍA
    // infinitamente (el write a Firestore no se reflejaba en memoria).
    patchConfigMeta({ hintsVistos: { ...(config?.meta.hintsVistos ?? {}), [key]: true } });
    if (!user?.uid) return;
    setDoc(doc(db, `users/${user.uid}/config/meta`),
      { meta: { hintsVistos: { [key]: true } } }, { merge: true },
    ).catch(() => {});
  }, [user, key, patchConfigMeta, config?.meta.hintsVistos]);

  return [show, dismiss];
}
