"use client";

import { useState } from "react";
import Image from "next/image";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useTranslation";
import { authErrorMessage } from "@/lib/firebase-error";
import { signInWithGoogle } from "@/lib/google-auth";
import { ensureUserDoc } from "@/services/firebase/config";

export default function LoginPage() {
  const t = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();

  const regError = (key: string): string => {
    switch (key) {
      case "invalid-code": return t.regInvalidCode;
      case "email-in-use": return t.regEmailInUse;
      case "weak-password": return t.regWeakPassword;
      case "invalid-email": return t.regInvalidEmail;
      default: return t.regGeneric;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, code: code.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(regError(data?.error)); return; }
      }
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserDoc(cred.user.uid).catch(() => {});
      router.replace("/");
    } catch (err: unknown) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (loading) return;
    setError(""); setInfo(""); setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if ((err as Error)?.message === "google-new-user") setError(t.googleNewUserErr);
      else if (code === "auth/account-exists-with-different-credential") setError(t.googleExistsErr);
      else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(""); setInfo("");
    if (!email.trim()) { setError(t.enterEmailFirst); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(t.resetSent);
    } catch {
      setError(t.resetError);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(""); setInfo("");
  };

  return (
    <div style={{ position: "relative", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", top: "-15%", left: "-10%", width: 420, height: 420, background: "radial-gradient(circle, var(--blue) 0%, transparent 70%)", opacity: 0.22, filter: "blur(40px)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 420, height: 420, background: "radial-gradient(circle, var(--green) 0%, transparent 70%)", opacity: 0.18, filter: "blur(40px)", pointerEvents: "none" }} />

      <div style={{ width: "min(400px, 100%)", position: "relative", zIndex: 1 }} className="fade-up">
        <div style={{ marginBottom: 28 }}>
          {/* width/height = tamaño INTRÍNSECO del archivo (9961×1983, ratio 5:1). Antes se
              declaraba 220×150 (ratio 1.47:1), que no es el del archivo, y Next avisaba por
              consola en cada carga. El alto real siempre fue ~44px (el ratio mandaba), así
              que `height: auto` mantiene el render idéntico. */}
          <Image src="/logo5-cropped.png" alt="FinMoves" width={9961} height={1983} priority style={{ display: "block", margin: "0 auto", width: 220, height: "auto" }} />
        </div>

        <form onSubmit={handleAuth} style={{
          background: "color-mix(in srgb, var(--surface) 75%, transparent)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: "1px solid var(--border-hi, var(--border))", borderRadius: 22, padding: 28,
          display: "flex", flexDirection: "column", gap: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>
          {/* Email */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex", pointerEvents: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3" /><path d="m3 6 9 6 9-6" />
              </svg>
            </span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input"
              style={{ paddingLeft: 46, height: 52 }} placeholder={t.loginEmailPlaceholder} disabled={loading} autoComplete="email" />
          </div>

          {/* Password */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex", pointerEvents: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input"
              style={{ paddingLeft: 46, paddingRight: 46, height: 52 }} placeholder={t.loginPassword} disabled={loading}
              autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? t.hide : t.show}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 6, display: "flex" }}>
              {showPw ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.5 7-10 7c-1.6 0-3-.4-4.3-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Código de invitación (solo registro) */}
          {mode === "signup" && (
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex", pointerEvents: "none" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2" />
                  <path d="M3 5h8v14H3a0 0 0 0 1 0 0V5a0 0 0 0 1 0 0z" /><path d="M7 9v6" />
                </svg>
              </span>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="input"
                style={{ paddingLeft: 46, height: 52, letterSpacing: 2, fontFamily: "var(--font-mono)" }} placeholder={t.inviteCodeLabel} disabled={loading} autoCapitalize="characters" />
            </div>
          )}

          {error && (
            <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: "10px 12px", fontSize: 12, color: "var(--red)", lineHeight: 1.5 }}>{error}</div>
          )}
          {info && (
            <div style={{ background: "var(--green-dim)", border: "1px solid var(--green)44", borderRadius: "var(--radius-sm)", padding: "10px 12px", fontSize: 12, color: "var(--green)", lineHeight: 1.5 }}>{info}</div>
          )}

          <button type="submit" disabled={loading} className="btn"
            style={{ marginTop: 4, height: 48, fontSize: 14, fontWeight: 700, color: "#fff", border: "none", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)", boxShadow: "0 8px 24px color-mix(in srgb, var(--blue) 40%, transparent)" }}>
            {loading ? (mode === "signup" ? t.signingUp : t.loginSigningIn) : (mode === "signup" ? t.signUp : t.loginSignIn)}
          </button>
        </form>

        {/* Entrar con Google (solo ingreso; el registro es por código) */}
        {mode === "signin" && (
          <button type="button" onClick={handleGoogle} disabled={loading} style={{
            marginTop: 14, width: "100%", height: 48, borderRadius: 12, cursor: loading ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "var(--surface)", border: "1px solid var(--border-hi, var(--border))", color: "var(--text)", fontSize: 14, fontWeight: 600,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
            {t.googleSignIn}
          </button>
        )}

        {/* Links */}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {mode === "signin" && (
            <button onClick={handleReset} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer", padding: 0 }}>
              {t.forgotPassword}
            </button>
          )}
          <button onClick={switchMode} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
            {mode === "signin" ? t.noAccountCreate : t.haveAccountSignIn}
          </button>
          <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
            <a href="/privacy" style={{ color: "var(--muted)", fontSize: 11, textDecoration: "none" }}>{t.privacyLink}</a>
            <a href="/terms" style={{ color: "var(--muted)", fontSize: 11, textDecoration: "none" }}>{t.termsLink}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
