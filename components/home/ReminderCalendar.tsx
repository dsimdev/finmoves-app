"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/hooks/useTranslation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import type { Recordatorio } from "@/services/firebase/recordatorios";
import type { RecurrenteProyectado } from "@/utils/recurrent-forecast";
import { fechaISO_AR } from "@/utils/fecha-ar";
import { useMounted } from "@/hooks/useMounted";

// Calendario de la card de recordatorios. No es un adorno: ES el control de entrada — se
// navega entre meses y se toca un día para cargar ahí (reemplaza al input de fecha, que
// ocupaba una fila y obligaba a escribir la fecha a mano).
//
// Un día con algo se marca con el NÚMERO en color + un punto abajo. Nada de rellenar la celda:
// se probó con fondo y borde teñidos y pintaba el día entero, comiéndose la grilla. El fondo
// queda solo para el día seleccionado, que es un estado de interacción.
//
// HOY lleva un punto VERDE propio, independiente del resto: así se reconoce aunque ese día
// además tenga un recordatorio o un recurrente.
//
// Los colores:
//   · recordatorio repetible → violeta · recordatorio puntual → teal
//   · recurrente proyectado  → naranja si falta, amarillo si se aproxima, rojo si venció
//     (los MISMOS umbrales que usa el cron para notificar)
//
// El recurrente es una PREDICCIÓN (cuándo se espera el próximo, según la última carga), no un
// hecho agendado: por eso si un día tiene las dos cosas manda el color del recordatorio, y el
// recurrente pasa a un punto bajo el número. El naranja del "lejos" evita el teal, que ya es
// el del recordatorio puntual.

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

/** YYYY-MM-DD de un día del mes mostrado, sin pasar por Date (evita corrimientos de zona). */
const iso = (anio: number, mes0: number, dia: number) =>
  `${anio}-${String(mes0 + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

export function ReminderCalendar({ recordatorios, recurrentes = [], seleccionado, onSelect, onCerrarDia, children }: {
  recordatorios: Recordatorio[];
  /** Recurrentes proyectados a su próxima fecha esperada (marca hueca). */
  recurrentes?: RecurrenteProyectado[];
  /** Día elegido (YYYY-MM-DD) o null si todavía no se tocó ninguno. */
  seleccionado: string | null;
  onSelect: (fecha: string) => void;
  /** Cierra el detalle del día (tocar afuera, Escape o la ×). */
  onCerrarDia: () => void;
  /** Detalle del día: sale como popover anclado a la celda tocada. */
  children: React.ReactNode;
}) {
  const t = useT();
  const { lang } = useAppPrefs();
  // Hoy (AR) se fija al montar: leerlo en el cuerpo del render es impuro (dos renders del
  // mismo día podrían no coincidir). Se toma una vez y de ahí sale también el mes inicial.
  const [hoyISO] = useState(fechaISO_AR);

  // Mes en vista: arranca en el del día de hoy y se mueve con las flechas.
  const [vista, setVista] = useState(() => {
    const [y, m] = hoyISO.split("-").map(Number);
    return { anio: y, mes: m - 1 };
  });

  // Posición del popover del día. Se calcula respecto del contenedor del calendario y se
  // acomoda solo: arriba o abajo de la celda según dónde haya lugar, y corrido en horizontal
  // para no salirse por los bordes.
  const wrapRef = useRef<HTMLDivElement>(null);
  const celdaRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);
  const mounted = useMounted(); // el portal necesita document

  // Se posiciona en coordenadas de VIEWPORT (el popover vive en un portal, fuera de la card):
  // si se anclara dentro, el overflow de la card lo recortaría y abriría scroll. Requiere
  // getBoundingClientRect (medida real del DOM ya pintado) — sincronizar con esa medida es el
  // uso de useLayoutEffect que React documenta como correcto, no el anti-patrón de derivar
  // estado que ya se pueda calcular en render.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seleccionado) { setPos(null); return; }
    const celda = celdaRefs.current[seleccionado];
    // Sin celda visible (el día quedó fuera del mes en vista) no hay dónde anclarlo: se limpia
    // la posición para que no quede flotando en el lugar viejo.
    if (!celda) { setPos(null); return; }
    const c = celda.getBoundingClientRect();
    const ANCHO = Math.min(280, window.innerWidth - 24);
    // Centrado en la celda, sin salirse de la pantalla.
    const left = Math.max(12, Math.min(c.left + c.width / 2 - ANCHO / 2, window.innerWidth - ANCHO - 12));
    // Si abajo no entra, se abre hacia arriba de la celda.
    const arriba = window.innerHeight - c.bottom < 260;
    const top = arriba ? c.top - 6 : c.bottom + 6;
    setPos({ top, left, arriba });
  }, [seleccionado, vista]);

  // Cerrar al tocar afuera o con Escape.
  useEffect(() => {
    if (!seleccionado) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = e.target as HTMLElement;
      // El popover está en un portal: no alcanza con mirar el contenedor del calendario.
      if (el.closest?.("[data-daypop]")) return;
      if (wrapRef.current?.contains(el)) return; // tocar otro día lo cambia, no lo cierra
      onCerrarDia();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrarDia(); };
    // Al ser fixed, el popover no acompaña el scroll de la card: se cierra para no quedar
    // flotando lejos del día que lo abrió.
    const onScroll = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.("[data-daypop]")) return; // scroll interno, no
      onCerrarDia();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true); // capture: agarra scroll de contenedores
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [seleccionado, onCerrarDia]);

  const { anio, mes } = vista;

  // Cambiar de mes CIERRA el día abierto: su celda deja de existir en la grilla y el popover
  // quedaba flotando sobre un mes que ya no es el suyo (el cierre por "tocar afuera" no lo
  // agarra, porque las flechas están dentro del calendario).
  const mover = (delta: number) => {
    if (seleccionado) onCerrarDia();
    // Las refs del mes que se va quedan apuntando a nodos desmontados: se descartan para no
    // resolver una celda vieja en el próximo posicionamiento.
    celdaRefs.current = {};
    setVista(({ anio: a, mes: m }) => {
      const total = a * 12 + m + delta;
      return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
    });
  };

  const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  // getUTCDay(): 0=domingo. La grilla arranca en lunes, así que domingo pasa a ser 6.
  const offset = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7;

  // Día del mes → si tiene recordatorio y si alguno de ese día repite.
  const porDia = new Map<number, { repite: boolean }>();
  for (const r of recordatorios) {
    const [y, m, d] = r.fecha.split("-").map(Number);
    if (y !== anio || m !== mes + 1) continue;
    porDia.set(d, { repite: (porDia.get(d)?.repite ?? false) || !!r.repetir });
  }

  // Día del mes → recurrentes esperados ahí. Un VENCIDO proyecta a una fecha ya pasada, así
  // que se ancla en HOY: es lo que sigue estando pendiente, y si no se movería fuera de vista
  // justo cuando más importa. Si hoy no está en el mes en vista, no se ancla nada.
  const recurrentesPorDia = new Map<number, RecurrenteProyectado[]>();
  const hoyEnVista = Number(hoyISO.slice(0, 4)) === anio && Number(hoyISO.slice(5, 7)) === mes + 1;
  for (const p of recurrentes) {
    let dia: number | null = null;
    if (p.estado === "vencido") {
      if (hoyEnVista) dia = Number(hoyISO.slice(8, 10));
    } else {
      const [y, m, d] = p.fecha.split("-").map(Number);
      if (y === anio && m === mes + 1) dia = d;
    }
    if (dia === null) continue;
    const arr = recurrentesPorDia.get(dia);
    if (arr) arr.push(p); else recurrentesPorDia.set(dia, [p]);
  }

  // Color del recurrente por urgencia, con los umbrales del cron. Si un día junta varios,
  // manda el más urgente. El "lejos" usa NARANJA y no teal: el teal ya es el punto del
  // recordatorio puntual y dos tonos casi iguales no se distinguían.
  const colorRecurrente = (ps: RecurrenteProyectado[]) =>
    ps.some((p) => p.estado === "vencido") ? "var(--red)"
      : ps.some((p) => p.estado === "cerca") ? "var(--yellow)"
      : "var(--orange)";

  const celdas: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const navBtn: React.CSSProperties = {
    background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
    padding: 4, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6,
  };

  return (
    <div ref={wrapRef} style={{ marginBottom: 14, position: "relative" }}>
      {/* Mes en vista + navegación */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <button type="button" onClick={() => mover(-1)} aria-label={t.prevMonth} style={navBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        {/* Solo el mes: el año se sobreentiende. Si la navegación sale del año en curso, se
            agrega para no perder la referencia. */}
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>
          {(() => {
            const d = new Date(Date.UTC(anio, mes, 1));
            const nombre = d.toLocaleDateString(lang === "en" ? "en-US" : "es-AR", { month: "long", timeZone: "UTC" });
            const mesCap = `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
            return anio === Number(hoyISO.slice(0, 4)) ? mesCap : `${mesCap} ${anio}`;
          })()}
        </span>
        <button type="button" onClick={() => mover(1)} aria-label={t.nextMonth} style={navBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 8.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.3 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`v${i}`} />;
          const fecha = iso(anio, mes, dia);
          const marca = porDia.get(dia);
          const recs = recurrentesPorDia.get(dia);
          const esHoy = fecha === hoyISO;
          const sel = fecha === seleccionado;
          const color = marca?.repite ? "var(--purple)" : "var(--teal)";
          const colorRec = recs ? colorRecurrente(recs) : null;
          // Color del NÚMERO. Si el día tiene recordatorio Y recurrente manda el recordatorio
          // (es algo agendado, no una estimación); el recurrente igual muestra su punto.
          const tinte = marca ? color : colorRec;
          return (
            <button
              key={dia}
              type="button"
              ref={(el) => { celdaRefs.current[fecha] = el; }}
              onClick={() => (sel ? onCerrarDia() : onSelect(fecha))}
              aria-label={fecha}
              aria-pressed={sel}
              style={{
                aspectRatio: "1", display: "flex", flexDirection: "column", cursor: "pointer",
                alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 7, padding: 0,
                // Fondo y borde son SOLO del día seleccionado: es un estado de interacción. Las
                // marcas (recordatorio, recurrente, hoy) NO pintan la celda — rellenarla se
                // comía la grilla. Se ven en el color del número y en el punto de abajo.
                background: sel ? "var(--accent)" : "transparent",
                border: `1px solid ${sel ? "var(--accent)" : "transparent"}`,
                transition: "background .12s",
              }}
            >
              <span style={{
                fontSize: 10, lineHeight: 1, fontVariantNumeric: "tabular-nums",
                // El número toma el color de lo que hay ese día: junto con el punto, es toda la
                // señal (la celda no se pinta).
                color: sel ? "#fff" : tinte ? tinte : esHoy ? "var(--text)" : "var(--muted)",
                fontWeight: sel || tinte || esHoy ? 700 : 400, opacity: sel || tinte || esHoy ? 1 : 0.55,
              }}>{dia}</span>
              {/* Fila de puntos bajo el número — la señal de qué hay ese día:
                  · verde = hoy (siempre, no depende de lo demás)
                  · el del recordatorio (violeta repetible / teal puntual)
                  · el del recurrente, en su color de urgencia
                  Un día puede juntar los tres sin que la celda cambie de tamaño. */}
              <span style={{ height: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                {esHoy && (
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: sel ? "#fff" : "var(--green)" }} />
                )}
                {marca && (
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: sel ? "#fff" : color }} />
                )}
                {colorRec && (
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: sel ? "#fff" : colorRec }} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detalle del día: en un PORTAL, para que ningún contenedor con overflow (la card que
          lo envuelve) lo recorte ni abra scroll. Se ancla a la celda en coords de viewport. */}
      {seleccionado && pos && mounted && createPortal(
        <div
          data-daypop
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed", zIndex: 10000,
            left: pos.left,
            width: Math.min(280, window.innerWidth - 24),
            // Hacia arriba se ancla por `bottom` para crecer en esa dirección.
            ...(pos.arriba
              ? { bottom: window.innerHeight - pos.top }
              : { top: pos.top }),
            maxHeight: "min(60vh, 420px)", overflowY: "auto",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            boxShadow: "0 12px 34px rgba(0,0,0,.45)", padding: "12px 13px",
            transformOrigin: pos.arriba ? "bottom center" : "top center",
            animation: "appearPopover var(--open-dur) var(--ease-out)",
          }}
        >
          {/* Sin botón de cerrar: se sale tocando afuera, con Escape o volviendo a tocar el
              día. Una × acá se pisaba con la × de cada recordatorio de la lista. */}
          {children}
        </div>,
        document.body
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) { [data-daypop] { animation: none !important } }
      `}</style>
    </div>
  );
}
