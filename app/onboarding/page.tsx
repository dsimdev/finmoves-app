"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { crearMovimiento } from "@/services/firebase/movimientos";
import { fechaAPeriodoId } from "@/utils/periodo";
import { useAuth } from "@/hooks/useAuth";
import { useConfig, saveConfigCache } from "@/hooks/useConfig";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { platformAuthenticatorAvailable, isBiometricEnabledFor, registerBiometric, clearBiometric } from "@/lib/biometric";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "@/lib/push-client";

type Moneda = "ARS" | "USD" | "EUR";

// **negrita** dentro de los textos de enseñanza.
const boldify = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
  part.startsWith("**") && part.endsWith("**") ? <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong> : part
);

// 6 pasos, setup + enseñanza intercalados:
// 0 Bienvenida+nombre · 1 Moneda/inversión · 2 Sueldo+período · 3 Gestos · 4 Seguridad · 5 Listo
const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { config, loading: cfgLoading } = useConfig(user?.uid);
  const { setMonedaPrincipal, set: setPref, setLang, lang } = useAppPrefs();

  const [step, setStep] = useState(0);
  const [nombre, setNombre] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [sueldo, setSueldo] = useState("");
  const [invierte, setInvierte] = useState(false);
  const [monedaInversion, setMonedaInversion] = useState<"USD" | "EUR">("USD");
  const [saving, setSaving] = useState(false);

  const [bioAvail, setBioAvail] = useState(false);
  // pushSupported() es sincrónica: sale del inicializador de useState. bioOn depende de
  // user?.uid, que puede llegar después del primer render, así que se re-sincroniza en el
  // efecto de abajo (no se puede resolver solo con un inicializador).
  const [pushAvail] = useState(pushSupported);
  const [bioOn, setBioOn] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // isBiometricEnabledFor es sincrónica pero depende de user?.uid (async por auth) — se
  // resuelve acá, no en el inicializador de bioOn.
  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvail);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBioOn(isBiometricEnabledFor(user?.uid));
    isPushEnabled().then(setPushOn);
  }, [user?.uid]);

  useEffect(() => {
    if (config && config.meta.onboardingCompleto !== false) router.replace("/");
  }, [config, router]);

  if (authLoading || cfgLoading || !user || !config) {
    return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}><LoadingSpinner /></div>;
  }

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setMonedaPrincipal(moneda);
    setPref("showAhorros", invierte);
    try {
      const nuevaConfig = {
        ...config,
        meta: {
          ...config.meta,
          ...(nombre.trim() ? { nombre: nombre.trim() } : {}),
          monedaPrincipal: moneda,
          showAhorros: invierte,
          ...(invierte ? { monedaInversiones: monedaInversion } : {}),
          showReportes: true,
          onboardingCompleto: true,
        },
      };
      await setDoc(doc(db, `users/${user.uid}/config/meta`), nuevaConfig);
      // Refrescar el cache de config: si no, el guard del home lee el cache viejo
      // (onboardingCompleto:false) y rebota de vuelta al onboarding → loop.
      saveConfigCache(user.uid, nuevaConfig);
      // Sueldo opcional: si lo cargó, abre el primer período para que el día 1 ya tenga
      // datos (el dashboard, si no, cae en "sin datos"). No bloquea el onboarding si falla.
      const montoSueldo = parseFloat(sueldo);
      if (montoSueldo > 0) {
        const now = new Date();
        const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        try {
          await crearMovimiento(user.uid, {
            timestampCarga: now, fecha: hoy, tipo: "Ingreso", categoria: "Sueldo",
            descripcion: "Sueldo", monto: montoSueldo, medioPago: "—", observaciones: "",
            periodoId: fechaAPeriodoId(hoy), userId: user.uid,
          });
        } catch { /* el usuario puede cargarlo después */ }
      }
      router.replace("/");
    } catch {
      setSaving(false);
    }
  };

  const toggleBio = async () => {
    if (!user || bioBusy) return;
    setBioBusy(true);
    try {
      if (bioOn) { clearBiometric(); setBioOn(false); }
      else { await registerBiometric(user.uid, user.email ?? ""); setBioOn(true); }
    } catch {}
    finally { setBioBusy(false); }
  };

  const togglePush = async () => {
    if (!user || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) { await disablePush(user.uid); setPushOn(false); }
      else { setPushOn(await enablePush(user.uid)); }
    } catch {}
    finally { setPushBusy(false); }
  };

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div style={{ position: "relative", minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", top: "-15%", left: "-10%", width: 420, height: 420, background: "radial-gradient(circle, var(--blue) 0%, transparent 70%)", opacity: 0.18, filter: "blur(40px)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 420, height: 420, background: "radial-gradient(circle, var(--green) 0%, transparent 70%)", opacity: 0.14, filter: "blur(40px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 8 }}>
        {(["es", "en"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "4px 8px", borderRadius: 8, color: lang === l ? "var(--accent)" : "var(--muted)", opacity: lang === l ? 1 : 0.5 }}>{l.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ position: "relative", display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i <= step ? "var(--accent)" : "var(--border)", transition: "all 0.2s" }} />
        ))}
      </div>

      <div key={step} className="fade-up" style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "min(420px, 100%)" }}>

          {step === 0 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <Image src="/favicon.png" alt="" width={72} height={72} style={{ opacity: 0.95 }} priority />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8 }}>{t.obWelcomeTitle}</div>
                <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{t.obWelcomeBody}</div>
              </div>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={t.obNamePlaceholder}
                maxLength={40}
                style={{
                  width: "100%", padding: "13px 16px", borderRadius: 14, fontSize: 15,
                  background: "var(--surface-alt)", border: "1px solid var(--border)",
                  color: "var(--text)", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>{t.obConfigTitle}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{t.obConfigSub}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>{t.obCurrencyLabel}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["ARS", "USD", "EUR"] as Moneda[]).map((m) => (
                    <button key={m} onClick={() => setMoneda(m)} style={{
                      flex: 1, padding: "12px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${moneda === m ? "var(--accent)" : "var(--border)"}`,
                      background: moneda === m ? "var(--accent-dim)" : "transparent",
                      color: moneda === m ? "var(--accent)" : "var(--muted)",
                    }}>{m}</button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>{t.obInvestQuestion}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setInvierte(true)} style={{
                    flex: 1, padding: "12px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${invierte ? "var(--green)" : "var(--border)"}`,
                    background: invierte ? "var(--green-dim)" : "transparent",
                    color: invierte ? "var(--green)" : "var(--muted)",
                  }}>{t.obInvestYes}</button>
                  <button onClick={() => setInvierte(false)} style={{
                    flex: 1, padding: "12px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${!invierte ? "var(--muted)" : "var(--border)"}`,
                    background: !invierte ? "var(--surface-alt)" : "transparent",
                    color: !invierte ? "var(--text)" : "var(--muted)",
                  }}>{t.obInvestNo}</button>
                </div>
                {invierte && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>{t.obInvestCurrencyLabel}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["USD", "EUR"] as const).map((m) => (
                        <button key={m} onClick={() => setMonedaInversion(m)} style={{
                          flex: 1, padding: "12px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer",
                          border: `1px solid ${monedaInversion === m ? "var(--yellow)" : "var(--border)"}`,
                          background: monedaInversion === m ? "var(--yellow-dim)" : "transparent",
                          color: monedaInversion === m ? "var(--yellow)" : "var(--muted)",
                        }}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>{t.obSalaryTitle}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{t.obSalarySub}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{moneda === "EUR" ? "€" : moneda === "USD" ? "US$" : "$"}</span>
                <input type="number" inputMode="decimal" value={sueldo} onChange={(e) => setSueldo(e.target.value)} placeholder="0" enterKeyHint="done"
                  style={{ flex: 1, background: "none", border: "none", color: "var(--text)", outline: "none", fontSize: 19, fontWeight: 700, fontFamily: "var(--font-mono)", minWidth: 0 }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.obSalaryOptional}</div>
              {/* Lección intercalada: el sueldo abre el período (concepto base de la app). */}
              <div style={{ marginTop: 4, textAlign: "left", background: "var(--accent-dim)", border: "1px solid var(--accent)33", borderRadius: 14, padding: "13px 15px", fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 5 }}>{t.obPeriodTitle}</div>
                {boldify(t.obPeriodBody)}
              </div>
            </div>
          )}

          {/* Paso ENSEÑANZA: gestos clave (una idea por línea, liviano). */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>{t.obGesturesTitle}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: <><line x1="7" y1="12" x2="17" y2="12" /><polyline points="11 8 7 12 11 16" /></>, txt: t.obGesturesSwipe, color: "var(--yellow)" },
                  { icon: <><circle cx="12" cy="12" r="3" /><path d="M12 5v-.01M12 19v.01M5 12h-.01M19 12h.01" /></>, txt: t.obGesturesTap, color: "var(--green)" },
                  { icon: <><polyline points="9 18 15 12 9 6" transform="translate(-3 0)" /><polyline points="9 18 15 12 9 6" transform="translate(3 0)" /></>, txt: t.obGesturesTabs, color: "var(--blue)" },
                ].map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 14, padding: "13px 15px" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${g.color} 16%, transparent)`, color: g.color }}>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{g.icon}</svg>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{g.txt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>{t.obSecurityTitle}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{t.obSecuritySub}</div>
              </div>
              {(bioAvail || pushAvail) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {bioAvail && <OnbRow label={t.obEnableBiometric} on={bioOn} busy={bioBusy} onClick={toggleBio} />}
                  {pushAvail && <OnbRow label={t.obEnableNotifications} on={pushOn} busy={pushBusy} onClick={togglePush} />}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>{t.obSecurityUnavailable}</div>
              )}
            </div>
          )}

          {/* Paso FINAL: cierre + puntero a la guía completa. */}
          {step === 5 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--green-dim)", color: "var(--green)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8 }}>{t.obReadyTitle}</div>
                <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{boldify(t.obReadyBody)}</div>
              </div>
            </div>
          )}

        </div>
      </div>

      <div style={{ position: "relative", display: "flex", gap: 12, alignItems: "center", maxWidth: 420, width: "100%", margin: "0 auto" }}>
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 14, color: "var(--muted)", fontSize: 14, fontWeight: 600, padding: "13px 20px", cursor: "pointer" }}>{t.obBack}</button>
        )}
        <button onClick={isLast ? finish : () => setStep((s) => s + 1)} disabled={saving}
          className="btn" style={{ flex: 1, height: 50, fontSize: 15, fontWeight: 700, color: "#fff", border: "none", borderRadius: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)", opacity: saving ? 0.5 : 1 }}>
          {step === 0 ? t.obStart : isLast ? t.obGo : t.obNext}
        </button>
      </div>
    </div>
  );
}

function OnbRow({ label, on, busy, onClick }: { label: string; on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface-alt)" }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
      <button onClick={onClick} disabled={busy} aria-pressed={on} style={{
        width: 46, height: 28, borderRadius: 999, border: "none", flexShrink: 0,
        cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
        background: on ? "var(--green)" : "var(--border)", position: "relative", transition: "background 0.15s",
      }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </button>
    </div>
  );
}
