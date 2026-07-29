"use client";
import { useEffect, useState } from "react";

// true recién después del primer render en el cliente. Lo usan los componentes con
// createPortal: el portal necesita `document`, que no existe durante el render de servidor,
// así que hay que esperar a estar montado antes de intentarlo.
//
// El setState del efecto es la ÚNICA forma de saber "ya estoy en el cliente" — no hay
// inicializador perezoso que lo reemplace (typeof document !== "undefined" da el mismo
// resultado en el primer render de cliente Y en la hidratación, pero rompería el server
// render, que es justo lo que este hook evita). El lint de set-state-in-effect no puede
// distinguir este caso legítimo del anti-patrón que señala.
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect
  return mounted;
}
