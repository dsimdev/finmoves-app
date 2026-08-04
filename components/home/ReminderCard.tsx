"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { CenterCard } from "@/components/ui/CenterCard";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { useData } from "@/app/(tabs)/data-context";
import { crearRecordatorio, listarRecordatorios, eliminarRecordatorio, type Recordatorio } from "@/services/firebase/recordatorios";
import { fechaCorta } from "@/utils/periodo";
import { proyectarRecurrentes } from "@/utils/recurrent-forecast";
import { ahoraAR, fechaISO_AR } from "@/utils/fecha-ar";
import { useMoney } from "@/hooks/useHideValues";
import { ReminderCalendar } from "./ReminderCalendar";

// Días entre hoy (AR) y una fecha YYYY-MM-DD. Negativo = ya venció.
function diasHasta(fecha: string): number {
  const ar = ahoraAR();
  const hoy = Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate());
  const [y, m, d] = fecha.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - hoy) / 86_400_000);
}

const ICON_CAL = (
  <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
);

/**
 * Card de recordatorios del Inicio. Arriba, el PRÓXIMO a vencer como héroe (para ver todos
 * está Configuración → Notificaciones); abajo, el form para agregar uno nuevo.
 */
export function ReminderCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const t = useT();
  const { m: money } = useMoney();
  const { movimientos, recurrentes } = useData();
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");
  const [repetir, setRepetir] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lista, setLista] = useState<Recordatorio[]>([]);
  // El próximo a vencer: listarRecordatorios ya viene ordenado por fecha asc.
  const proximo = lista[0] ?? null;

  const cargar = useCallback(() => {
    if (!user?.uid) return;
    listarRecordatorios(user.uid).then(setLista).catch(() => {});
  }, [user]);
  useEffect(() => { if (open) cargar(); }, [open, cargar]);

  // Los del día elegido: se listan sobre el form para poder borrarlos sin ir a Configuración.
  const delDia = fecha ? lista.filter((r) => r.fecha === fecha) : [];

  // Hoy (AR) se fija al montar: leer el reloj durante el render es impuro y dos renders del
  // mismo día podrían no coincidir. La card se abre y cierra, así que se recalcula seguido.
  const [hoyISO] = useState(fechaISO_AR);

  // Recurrentes proyectados a su próxima fecha esperada. Mismo cálculo que usa el cron para
  // notificar (utils/recurrent-forecast), así el calendario y el push no se contradicen.
  const proyectados = useMemo(
    () => proyectarRecurrentes(recurrentes, movimientos, hoyISO),
    [recurrentes, movimientos, hoyISO],
  );

  // Los que caen en el día elegido. Los vencidos se muestran en HOY (es donde los ancla el
  // calendario), no en su fecha esperada ya pasada.
  const recurrentesDelDia = fecha
    ? proyectados.filter((p) => (p.estado === "vencido" ? fecha === hoyISO : p.fecha === fecha))
    : [];

  const guardar = async () => {
    if (!user?.uid || !texto.trim() || !fecha || saving) return;
    setSaving(true);
    try {
      await crearRecordatorio(user.uid, texto.trim(), fecha, repetir);
      // La card queda abierta en el mismo día: cargar varios seguidos es lo natural acá.
      setTexto(""); setRepetir(false);
      cargar();
    } catch { /* queda abierto para reintentar */ }
    finally { setSaving(false); }
  };

  const borrar = async (id: string) => {
    if (!user?.uid) return;
    setLista((prev) => prev.filter((r) => r.id !== id)); // optimista
    eliminarRecordatorio(user.uid, id).catch(cargar);    // si falla, recarga la verdad
  };

  const listo = !!texto.trim() && !!fecha;
  const dias = proximo ? diasHasta(proximo.fecha) : 0;
  const cuando = dias < 0 ? t.agendaOverdue : dias === 0 ? t.agendaToday : dias === 1 ? t.agendaTomorrow : t.agendaInDays(dias);
  // Urgencia por color: vencido rojo, hoy/mañana amarillo, más lejos teal.
  const c = dias < 0 ? "var(--red)" : dias <= 1 ? "var(--yellow)" : "var(--teal)";

  return (
    <CenterCard open={open} onClose={onClose} title={t.reminderShort}>
      {/* Héroe: el próximo a vencer. Ícono en halo + "cuándo" como protagonista. */}
      {proximo ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 11, background: `color-mix(in srgb, ${c} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`, color: c }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{ICON_CAL}</svg>
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>{t.agendaNext}</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2, color: c }}>{cuando}</div>
          <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proximo.texto}</div>
          {proximo.repetir && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 7, fontSize: 10, fontWeight: 700, color: "var(--purple)", background: "color-mix(in srgb, var(--purple) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--purple) 40%, transparent)", borderRadius: 999, padding: "3px 9px" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
              {t.reminderRepeats}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>{t.agendaEmpty}</div>
      )}

      {/* El calendario ES el control: se navega y se toca un día. El detalle de ese día sale
          como popover ANCLADO a la fecha tocada, así la card no crece hacia abajo. */}
      <ReminderCalendar
        recordatorios={lista}
        recurrentes={proyectados}
        seleccionado={fecha || null}
        onSelect={setFecha}
        onCerrarDia={() => { setFecha(""); setTexto(""); setRepetir(false); }}
      >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Recurrentes esperados ese día. Son una PREDICCIÓN, no algo agendado: van con punto
            hueco y sin × (no se borran desde acá, se gestionan en Movimientos). */}
        {recurrentesDelDia.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recurrentesDelDia.map((p) => {
              // Mismos colores que el tinte de la celda (naranja el lejano, no teal: ese es el
              // del recordatorio puntual).
              const c = p.estado === "vencido" ? "var(--red)" : p.estado === "cerca" ? "var(--yellow)" : "var(--orange)";
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-alt)", borderRadius: 9, padding: "7px 11px" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: `1.4px solid ${c}` }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.descripcion}</span>
                  <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: c, flexShrink: 0 }}>{money(p.monto)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Lo que ya hay ese día, con × para borrarlo sin salir de la card. */}
        {delDia.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {delDia.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-alt)", borderRadius: 9, padding: "7px 8px 7px 11px" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: r.repetir ? "var(--purple)" : "var(--teal)" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.texto}</span>
                <button type="button" onClick={() => borrar(r.id)} aria-label={t.delete} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" }}>
          {fecha && t.reminderOnDay(fechaCorta(fecha))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
          <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.reminderTextPlaceholder} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } }} />
          <button type="button" onClick={guardar} disabled={!listo || saving} aria-label={t.save} style={{
            width: 46, height: 46, borderRadius: "50%", border: "none", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: listo ? "var(--accent)" : "var(--surface-alt)", color: listo ? "#fff" : "var(--muted)",
            cursor: listo ? "pointer" : "default", opacity: saving ? 0.6 : 1, transition: "background .2s",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
        </div>
        {/* Repetir: vuelve el mismo día de cada mes. Se ofrece recién con fecha elegida,
            porque el texto nombra ese día ("todos los 23"). */}
        <button
          type="button"
          role="switch"
          aria-checked={repetir}
          disabled={!fecha}
          onClick={() => setRepetir((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 9, background: "none", border: "none",
            padding: "2px 0", cursor: fecha ? "pointer" : "default", opacity: fecha ? 1 : 0.45,
            color: repetir ? "var(--purple)" : "var(--muted)", fontSize: 12, fontWeight: 600,
          }}
        >
          <span style={{
            width: 34, height: 19, borderRadius: 999, flexShrink: 0, position: "relative", display: "block",
            background: repetir ? "var(--purple)" : "var(--surface-alt)",
            border: `1px solid ${repetir ? "var(--purple)" : "var(--border)"}`, transition: "background .15s",
          }}>
            <span style={{ position: "absolute", top: 2, left: repetir ? 16 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
          </span>
          {fecha && t.reminderRepeatDay(Number(fecha.split("-")[2]))}
        </button>
      </div>
      </ReminderCalendar>
    </CenterCard>
  );
}
