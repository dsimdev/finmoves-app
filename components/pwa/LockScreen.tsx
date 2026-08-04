"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useT } from "@/hooks/useTranslation";
import { verifyBiometric } from "@/lib/biometric";
import { Loader } from "@/components/ui/Loader";

export function LockScreen({ onUnlock, onUsePassword }: { onUnlock: () => void; onUsePassword: () => void }) {
  const t = useT();
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = useCallback(async () => {
    setVerifying(true);
    setFailed(false);
    const ok = await verifyBiometric();
    setVerifying(false);
    if (ok) onUnlock();
    else setFailed(true);
  }, [onUnlock]);

  // Intento automático al montar. `attempt` llama setVerifying(true) ANTES del primer await
  // (para mostrar "verificando…" desde que arranca) — el lint lo marca como si fuera un
  // setState directo en el efecto, pero es el patrón correcto de "estado de carga antes de una
  // operación async", no el anti-patrón que la regla busca (derivar estado de deps/props).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    attempt();
  }, [attempt]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "var(--bg)", color: "var(--text)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, gap: 22, textAlign: "center",
    }}>
      {/* Glow */}
      <div aria-hidden style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: 320, height: 320,
        background: "radial-gradient(circle, var(--blue) 0%, transparent 70%)",
        opacity: 0.15, filter: "blur(40px)", pointerEvents: "none",
      }} />

      <Image src="/logo-fm-1024.png" alt="FinMoves" width={84} height={84} style={{ opacity: 0.95, position: "relative" }} priority />

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: -0.3 }}>{t.lockTitle}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{failed ? t.unlockFailed : t.lockSubtitle}</div>
      </div>

      {/* Botón huella */}
      <button
        onClick={attempt}
        disabled={verifying}
        style={{
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          height: 52, padding: "0 26px", borderRadius: 14, border: "none", cursor: "pointer",
          background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)",
          color: "#fff", fontSize: 14.5, fontWeight: 700,
          boxShadow: "0 8px 24px color-mix(in srgb, var(--blue) 40%, transparent)",
          opacity: verifying ? 0.7 : 1,
        }}
      >
        {verifying ? (
          <Loader size={20} thickness={2.5} color="#fff" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 11c0 3 0 6-1 8.5" />
            <path d="M8 11a4 4 0 0 1 8 0c0 3.5-.5 6-1.5 8" />
            <path d="M5 11a7 7 0 0 1 14 0c0 1.5 0 3-.3 4.5" />
            <path d="M3 9a9 9 0 0 1 4-3.5M21 9a9 9 0 0 0-4-3.5" />
          </svg>
        )}
        {t.unlockWithFingerprint}
      </button>

      <button
        onClick={onUsePassword}
        style={{
          position: "relative", background: "none", border: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "underline", padding: 6,
        }}
      >
        {t.usePassword}
      </button>
    </div>
  );
}
