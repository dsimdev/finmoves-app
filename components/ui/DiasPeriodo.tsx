import { useState } from "react";
import { parsePeriodoId } from "@/utils/reportes";
import { titleGradText } from "./gradients";

// Días transcurridos del período vigente (el más reciente), para el slot izquierdo del
// PageHeader. Solo el número + "días", sin label. Se muestra en Inicio, Movimientos,
// Cartera y Reportes (no en Configuración).
export function DiasPeriodo({ periodoId }: { periodoId?: string }) {
  // "Ahora" se fija al montar: leer el reloj en el cuerpo del render es impuro (el compilador
  // no puede garantizar que dos renders den el mismo resultado). El componente vive en el
  // header y se remonta con cada navegación, así que igual se refresca seguido.
  const [ahora] = useState(() => Date.now());
  if (!periodoId) return null;
  const dias = Math.max(1, Math.floor((ahora - parsePeriodoId(periodoId).getTime()) / 86400000) + 1);
  return (
    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", ...titleGradText }}>
      {dias} días
    </div>
  );
}
