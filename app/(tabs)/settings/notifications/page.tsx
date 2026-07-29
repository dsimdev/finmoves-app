"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { isoToFechaAR } from "@/lib/sheet-format";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "@/lib/push-client";
import { listarRecordatorios, crearRecordatorio, eliminarRecordatorio, setRepetir, type Recordatorio } from "@/services/firebase/recordatorios";
import { setRecurrenteActivo, eliminarRecurrente } from "@/services/firebase/recurrentes";
import { useData } from "../../data-context";
import { Toggle, SubHeader } from "../_shared";

export default function NotificacionesSettings() {
  const { user } = useAuth();
  const t = useT();

  // pushSupported() es sincrónico (chequea navigator/ServiceWorker): sale del inicializador
  // de useState, no de un setState dentro del efecto.
  const [pushAvailable] = useState(pushSupported);
  const [pushOn, setPushOn] = useState(false);
  const [pushError, setPushError] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (pushAvailable) isPushEnabled().then(setPushOn);
  }, [pushAvailable]);
  const togglePush = async () => {
    if (pushBusy || !user?.uid) return;
    setPushError("");
    setPushBusy(true);
    try {
      if (pushOn) { await disablePush(user.uid); setPushOn(false); }
      else {
        const ok = await enablePush(user.uid);
        if (ok) setPushOn(true);
        else { setPushError(t.notificationsDenied); setTimeout(() => setPushError(""), 6000); }
      }
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : t.notificationsError;
      setPushError(msg); setTimeout(() => setPushError(""), 8000);
    } finally { setPushBusy(false); }
  };

  // Recordatorios puntuales
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [recTexto, setRecTexto] = useState("");
  const [recFecha, setRecFecha] = useState("");
  useEffect(() => { if (user?.uid) listarRecordatorios(user.uid).then(setRecordatorios).catch(() => {}); }, [user?.uid]);
  const addRecordatorio = async () => {
    if (!user?.uid || !recTexto.trim() || !recFecha) return;
    await crearRecordatorio(user.uid, recTexto.trim(), recFecha);
    setRecTexto(""); setRecFecha("");
    listarRecordatorios(user.uid).then(setRecordatorios).catch(() => {});
  };
  const delRecordatorio = async (id: string) => {
    if (!user?.uid) return;
    await eliminarRecordatorio(user.uid, id);
    setRecordatorios((prev) => prev.filter((r) => r.id !== id));
  };
  // Repetición mensual de un recordatorio ya creado. Optimista: el toggle responde al toque
  // y se revierte si la escritura falla.
  const toggleRepetir = async (r: Recordatorio) => {
    if (!user?.uid) return;
    const valor = !r.repetir;
    setRecordatorios((prev) => prev.map((x) => (x.id === r.id ? { ...x, repetir: valor } : x)));
    try {
      await setRepetir(user.uid, r.id, valor, r.fecha);
    } catch {
      setRecordatorios((prev) => prev.map((x) => (x.id === r.id ? { ...x, repetir: !valor } : x)));
    }
  };

  // Recurrentes (del DataProvider: fuente única, así el marcado en Movimientos
  // se mantiene en sync al togglear/borrar acá).
  const { recurrentes, mutateRecurrentes } = useData();
  const toggleRecurrente = async (id: string, activo: boolean) => {
    if (!user?.uid) return;
    mutateRecurrentes((prev) => prev.map((r) => (r.id === id ? { ...r, activo } : r)));
    await setRecurrenteActivo(user.uid, id, activo).catch(() => {});
  };
  const delRecurrente = async (id: string) => {
    if (!user?.uid) return;
    await eliminarRecurrente(user.uid, id);
    mutateRecurrentes((prev) => prev.filter((r) => r.id !== id));
  };

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };

  return (
    <div className="page page-narrow">
      <SubHeader title={t.notifications} />

      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14 }}>{t.notifications}</div>
          <div style={{ fontSize: 11, color: pushError ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{pushError || t.notificationsSub}</div>
        </div>
        {pushAvailable && <Toggle activo={pushOn} onClick={togglePush} />}
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t.reminders}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input className="input" type="text" placeholder={t.reminderTextPlaceholder} value={recTexto} onChange={(e) => setRecTexto(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="date" value={recFecha} onChange={(e) => setRecFecha(e.target.value)} style={{ width: 140 }} />
          <button onClick={addRecordatorio} disabled={!recTexto.trim() || !recFecha} aria-label={t.add} style={{
            flexShrink: 0, width: 44, borderRadius: "var(--radius-sm)", border: "none",
            background: recTexto.trim() && recFecha ? "var(--green)" : "var(--surface-alt)",
            color: recTexto.trim() && recFecha ? "var(--bg)" : "var(--muted)", cursor: recTexto.trim() && recFecha ? "pointer" : "default", fontSize: 22, lineHeight: 1,
          }}>+</button>
        </div>
        {recordatorios.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>{t.noReminders}</div>
        ) : recordatorios.map((r) => (
          <div key={r.id} className="row" style={{ padding: "11px 0", borderBottom: "1px solid var(--faint)", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.texto}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                {isoToFechaAR(r.fecha)}
                {r.repetir && <span style={{ color: "var(--purple)", fontWeight: 700 }}> · {t.reminderRepeats}</span>}
              </div>
            </div>
            {/* Repetir mensual: el mismo día de cada mes. Al apagarlo vuelve a ser puntual
                (se borra cuando avise). */}
            <Toggle activo={!!r.repetir} onClick={() => toggleRepetir(r)} />
            <button onClick={() => delRecordatorio(r.id)} aria-label={t.delete} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.recurrentsTitle}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>{t.recurrentsSub}</div>
        {recurrentes.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>{t.noRecurrents}</div>
        ) : recurrentes.map((r) => (
          <div key={r.id} className="row" style={{ padding: "11px 0", borderBottom: "1px solid var(--faint)", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: r.activo ? 1 : 0.5 }}>{r.descripcion || r.categoria}{r.observaciones ? ` · ${r.observaciones}` : ""}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{r.categoria} · {t.tipoDisplay[r.tipo]}</div>
            </div>
            <Toggle activo={r.activo} onClick={() => toggleRecurrente(r.id, !r.activo)} />
            <button onClick={() => delRecurrente(r.id)} aria-label={t.delete} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
