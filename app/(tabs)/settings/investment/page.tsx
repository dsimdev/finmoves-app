"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useT } from "@/hooks/useTranslation";
import { Loader } from "@/components/ui/Loader";
import { db } from "@/services/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { dbErrorMessage } from "@/lib/firebase-error";
import { Toggle, SubHeader } from "../_shared";

export default function InvestmentSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh } = useData();
  const { showAhorros, monedaInversiones, monedaPrincipal, set: setPref, setMoneda } = useAppPrefs();
  const { cotizacion } = useCotizacion();
  const t = useT();

  const [guardando, setGuardando] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Meta propia (todos): sobre los ahorros ya calculados, en la moneda principal.
  const [propiaMonto, setPropiaMonto] = useState("");
  const [propiaFecha, setPropiaFecha] = useState("");
  // Meta FX (solo ARS): sobre la reserva en divisa.
  const [fxMonto, setFxMonto] = useState("");
  const [fxFecha, setFxFecha] = useState("");
  const [cotizManualOn, setCotizManualOn] = useState(false);
  const [cotizManualVal, setCotizManualVal] = useState("");

  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;
  const esARS = monedaPrincipal === "ARS";
  const showFX = esARS && inversionAllowed;
  const simboloPropio = monedaPrincipal === "EUR" ? "€" : monedaPrincipal === "USD" ? "U$D" : "$";
  const monedaFX = monedaInversiones === "EUR" ? "EUR" : "USD";

  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try { await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig); refresh(); }
    catch (err) { setSaveMsg({ ok: false, text: dbErrorMessage(err, t) }); setTimeout(() => setSaveMsg(null), 3000); }
    finally { setGuardando(false); }
  };

  const tasaAuto = cotizacion ? (monedaInversiones === "EUR" ? cotizacion.oficial_euro ?? null : cotizacion.oficial) : null;
  const tasaEnUso = cotizManualOn && cotizManualVal && parseFloat(cotizManualVal) > 0 ? parseFloat(cotizManualVal) : tasaAuto;

  // ── Hidratar campos desde config ── Los campos son editables (el usuario los tipea); este
  // efecto los re-sincroniza con Firestore cuando config cambia (carga inicial o tras guardar
  // desde otra pestaña/dispositivo). Sincronizar con esa fuente externa es el uso de efecto
  // que React documenta como correcto.
  useEffect(() => {
    if (!config) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPropiaMonto(config.meta.metaPropia?.monto?.toString() ?? "");
    setPropiaFecha(config.meta.metaPropia?.fecha ?? "");
    setFxMonto(config.meta.metaFX?.monto?.toString() ?? "");
    setFxFecha(config.meta.metaFX?.fecha ?? "");
    setCotizManualOn(!!config.meta.cotizacionManualActiva);
    setCotizManualVal(config.meta.cotizacionManual?.toString() ?? "");
  }, [config?.meta.metaPropia?.monto, config?.meta.metaPropia?.fecha, config?.meta.metaFX?.monto, config?.meta.metaFX?.fecha, config?.meta.cotizacionManualActiva, config?.meta.cotizacionManual]);

  const propiaDirty = useMemo(() => {
    if (!config) return false;
    return propiaMonto !== (config.meta.metaPropia?.monto?.toString() ?? "") || propiaFecha !== (config.meta.metaPropia?.fecha ?? "");
  }, [propiaMonto, propiaFecha, config]);

  const fxDirty = useMemo(() => {
    if (!config) return false;
    const savedManualOn = !!config.meta.cotizacionManualActiva;
    const savedManualVal = config.meta.cotizacionManual?.toString() ?? "";
    return fxMonto !== (config.meta.metaFX?.monto?.toString() ?? "") || fxFecha !== (config.meta.metaFX?.fecha ?? "") || cotizManualOn !== savedManualOn || (cotizManualOn && cotizManualVal !== savedManualVal);
  }, [fxMonto, fxFecha, cotizManualOn, cotizManualVal, config]);

  const guardarPropia = async () => {
    if (!config) return;
    const newMeta = { ...config.meta };
    const nuevoMonto = propiaMonto && parseFloat(propiaMonto) > 0 ? parseFloat(propiaMonto) : null;
    // Objetivo nuevo → los hitos festejados del anterior no aplican (si no, una meta más
    // alta arrancaría "con el 50% ya usado" y nunca festejaría ese tramo de nuevo).
    if (nuevoMonto !== (config.meta.metaPropia?.monto ?? null)) delete newMeta.metaPropiaHitos;
    if (nuevoMonto) newMeta.metaPropia = { monto: nuevoMonto, ...(propiaFecha ? { fecha: propiaFecha } : {}) };
    else delete newMeta.metaPropia;
    await saveConfig({ ...config, meta: newMeta });
  };

  const guardarFX = async () => {
    if (!config) return;
    const newMeta = { ...config.meta };
    const nuevoMontoFX = fxMonto && parseFloat(fxMonto) > 0 ? parseFloat(fxMonto) : null;
    // Igual que la meta propia: monto o moneda distintos = objetivo nuevo, hitos limpios.
    if (nuevoMontoFX !== (config.meta.metaFX?.monto ?? null) || monedaFX !== config.meta.metaFX?.moneda) delete newMeta.metaFXHitos;
    if (nuevoMontoFX) newMeta.metaFX = { monto: nuevoMontoFX, moneda: monedaFX, ...(fxFecha ? { fecha: fxFecha } : {}) };
    else delete newMeta.metaFX;
    if (cotizManualOn && cotizManualVal && parseFloat(cotizManualVal) > 0) { newMeta.cotizacionManualActiva = true; newMeta.cotizacionManual = parseFloat(cotizManualVal); }
    else { delete newMeta.cotizacionManualActiva; delete newMeta.cotizacionManual; }
    await saveConfig({ ...config, meta: newMeta });
  };

  if (!config) return null;
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", marginBottom: 6 };

  const saveButton = (dirty: boolean, onClick: () => void, onClear?: () => void) => (
    <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 52 }}>
      <button onClick={onClick} disabled={!dirty || guardando} style={{ width: 56, height: 56, borderRadius: "50%", background: dirty ? "var(--green)" : "transparent", border: `2px solid ${dirty ? "var(--green)" : "var(--border)"}`, color: dirty ? "var(--bg)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: dirty ? "pointer" : "default", opacity: guardando ? 0.5 : 1 }}>
        {guardando ? <Loader size={20} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
      {onClear && (
        <button onClick={onClear} aria-label={t.clear} style={{ position: "absolute", right: 0, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="20" y1="4" x2="12" y2="12" /><path d="M12.5 11.5 6 18l3 3 6.5-6.5z" /><path d="M7 17.5 5 19.5M9 18.5 7.5 20M11 19.5 10 21" /></svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="page page-narrow">
      <SubHeader title={t.settingsTabInvestments} />

      {/* Toggle: mostrar la tab Inversión */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: showAhorros ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${showAhorros ? "var(--green)44" : "var(--red)44"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 1 18" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 7 22 7 22 13" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.investmentsSection}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.showInvestmentsLabel}</div>
          </div>
        </div>
        <Toggle activo={showAhorros} onClick={() => { const next = !showAhorros; setPref("showAhorros", next); saveConfig({ ...config, meta: { ...config.meta, showAhorros: next } }); }} />
      </div>

      {showAhorros && (
        <>
          {/* Sección A — Meta de ahorro (todos), sobre los ahorros calculados */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--green-dim)", border: "1px solid var(--green)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{simboloPropio}</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.ownGoalTitle}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.ownGoalDesc(simboloPropio)}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
              <div><div style={label}>{t.goalAmount(simboloPropio)}</div><input type="number" inputMode="decimal" value={propiaMonto} placeholder="0" onChange={(e) => setPropiaMonto(e.target.value)} className="input" style={{ width: "100%", fontFamily: "var(--font-mono)" }} /></div>
              <div><div style={label}>{t.optionalDate}</div><input type="date" value={propiaFecha} onChange={(e) => setPropiaFecha(e.target.value)} className="input" style={{ width: "100%" }} /></div>
            </div>
            {saveButton(propiaDirty, guardarPropia, (propiaMonto || propiaFecha) ? () => { setPropiaMonto(""); setPropiaFecha(""); } : undefined)}
          </div>

          {/* Sección B — Reserva en divisa (solo ARS con permiso) */}
          {showFX && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--yellow-dim)", border: "1px solid var(--yellow)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{monedaInversiones === "EUR" ? "€" : "U$D"}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{t.fxReserveTitle}</div>
                    {config.meta.metaFX?.monto ? <span style={{ fontSize: 10, color: "var(--muted)" }}>{t.activeGoal}</span> : null}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.fxReserveDesc}</div>
                </div>
              </div>

              {/* Moneda de inversión (bloqueada si hay meta FX activa) */}
              <div style={{ marginBottom: 14 }}>
                <div style={label}>{t.investmentCurrency}</div>
                {config.meta.metaFX?.monto ? (
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.cantChangeWithGoal}</div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["USD", "EUR"] as const).map((m) => (
                      <button key={m} onClick={() => { setMoneda(m); saveConfig({ ...config, meta: { ...config.meta, monedaInversiones: m } }); }} className="pill" style={{ borderColor: monedaInversiones === m ? "var(--yellow)" : "var(--border)", background: monedaInversiones === m ? "var(--yellow-dim)" : "transparent", color: monedaInversiones === m ? "var(--yellow)" : "var(--muted)" }}>{m}</button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--faint)", paddingTop: 12, marginBottom: 12 }}>
                {t.exchangeRate}: {tasaEnUso != null ? `$${tasaEnUso.toLocaleString("es-AR")}` : "—"} ({monedaFX})
              </div>

              <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-alt)", border: "1px solid var(--border)", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{cotizManualOn ? t.rateModeManual : t.manualRateAuto}</div>
                  <Toggle activo={cotizManualOn} onClick={() => setCotizManualOn((v) => !v)} />
                </div>
                {cotizManualOn && <input type="number" inputMode="decimal" value={cotizManualVal} placeholder="0" onChange={(e) => setCotizManualVal(e.target.value)} className="input" style={{ width: "100%", marginTop: 10, fontFamily: "var(--font-mono)" }} />}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
                <div><div style={label}>{t.goalAmount(monedaFX)}</div><input type="number" inputMode="decimal" value={fxMonto} placeholder="0" onChange={(e) => setFxMonto(e.target.value)} className="input" style={{ width: "100%", fontFamily: "var(--font-mono)" }} /></div>
                <div><div style={label}>{t.optionalDate}</div><input type="date" value={fxFecha} onChange={(e) => setFxFecha(e.target.value)} className="input" style={{ width: "100%" }} /></div>
              </div>
              {saveButton(fxDirty, guardarFX, (fxMonto || fxFecha) ? () => { setFxMonto(""); setFxFecha(""); } : undefined)}
            </div>
          )}
        </>
      )}

      {saveMsg && <div className="fade-up" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)", zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, background: saveMsg.ok ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${saveMsg.ok ? "var(--green)" : "var(--red)"}44`, color: saveMsg.ok ? "var(--green)" : "var(--red)", textAlign: "center", backdropFilter: "blur(8px)" }}>{saveMsg.text}</div>}
    </div>
  );
}
