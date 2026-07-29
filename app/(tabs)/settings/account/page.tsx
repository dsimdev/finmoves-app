"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";
import { auth } from "@/services/firebase/firebase";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, getIdToken } from "firebase/auth";
import { linkGoogle, isGoogleLinked } from "@/lib/google-auth";
import { platformAuthenticatorAvailable, isBiometricEnabledFor, registerBiometric, clearBiometric } from "@/lib/biometric";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SubHeader } from "../_shared";
import { Toggle } from "../_shared";

export default function AccountSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh } = useData();
  const t = useT();
  const router = useRouter();

  const [fotoErrorUrl, setFotoErrorUrl] = useState<string | null>(null);
  // isGoogleLinked() lee auth.currentUser directo (sincrónico): el inicializador cubre el
  // primer render; el efecto de abajo solo re-sincroniza cuando cambia el usuario después.
  const [googleLinked, setGoogleLinked] = useState(isGoogleLinked);
  const [googleErr, setGoogleErr] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const [showChangePass, setShowChangePass] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [passVisible, setPassVisible] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [bioAvailable, setBioAvailable] = useState(false);
  // isBiometricEnabledFor es sincrónica: mismo patrón que googleLinked arriba.
  const [bioEnabled, setBioEnabled] = useState(() => isBiometricEnabledFor(user?.uid));
  const [bioError, setBioError] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);

  // Re-sincroniza con auth/biometría (sistemas externos) cuando el usuario cambia DESPUÉS
  // del montaje — el inicializador de arriba solo cubre el primer render. Es el uso de
  // efecto que React documenta como correcto ("sincronizar con un sistema externo"), no el
  // anti-patrón de la regla (derivar estado de props/deps que ya se puede calcular directo).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoogleLinked(isGoogleLinked());
    setBioEnabled(isBiometricEnabledFor(user?.uid));
    platformAuthenticatorAvailable().then(setBioAvailable);
  }, [user?.uid]);

  const handleLinkGoogle = async () => {
    if (googleLinked) return;
    setGoogleErr("");
    try { await linkGoogle(); setGoogleLinked(true); refresh(); }
    catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") { setGoogleErr(t.googleLinkErr); setTimeout(() => setGoogleErr(""), 4000); }
    }
  };
  const handleUnlinkGoogle = async () => {
    if (!auth.currentUser) return;
    try { const { unlink } = await import("firebase/auth"); await unlink(auth.currentUser, "google.com"); setGoogleLinked(false); setConfirmUnlink(false); }
    catch { setGoogleErr(t.googleUnlinkErr); setTimeout(() => setGoogleErr(""), 4000); setConfirmUnlink(false); }
  };

  const openChangePass = () => { setPassInput(""); setCurrentPassInput(""); setPassVisible(false); setProfileMsg(null); setShowChangePass(true); };
  const savePassword = async () => {
    if (profileBusy) return;
    if (passInput.length < 6) { setProfileMsg({ ok: false, text: t.regWeakPassword }); return; }
    if (!currentPassInput) { setProfileMsg({ ok: false, text: t.currentPasswordRequired }); return; }
    setProfileBusy(true); setProfileMsg(null);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser!.email!, currentPassInput);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await updatePassword(auth.currentUser!, passInput);
      setProfileMsg({ ok: true, text: t.passwordChangedRelogin });
      setPassInput(""); setCurrentPassInput("");
      setTimeout(async () => { useAppPrefs.getState().reset(); await signOut(auth); router.replace("/home"); }, 1400);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      const text = code === "auth/wrong-password" || code === "auth/invalid-credential" ? t.wrongCurrentPassword : code === "auth/requires-recent-login" ? t.reauthNeeded : t.profileError;
      setProfileMsg({ ok: false, text });
    } finally { setProfileBusy(false); }
  };

  const toggleBiometric = async () => {
    setBioError("");
    if (bioEnabled) { clearBiometric(); setBioEnabled(false); return; }
    if (!user?.uid || !user.email) return;
    try { await registerBiometric(user.uid, user.email); setBioEnabled(true); }
    catch { setBioError(t.biometricEnableError); setTimeout(() => setBioError(""), 3000); }
  };

  const handleRequestDeletion = async () => {
    if (!auth.currentUser) return;
    setDeleteBusy(true);
    try { const token = await getIdToken(auth.currentUser); await fetch("/api/account/request-deletion", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); setDeleteRequested(true); setShowDeleteConfirm(false); }
    catch { /* ignore */ } finally { setDeleteBusy(false); }
  };

  if (!config) return null;
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const googlePhoto = auth.currentUser?.providerData.find((p) => p.providerId === "google.com")?.photoURL;
  const fotoSrc = config.meta.fotoURL || googlePhoto || null;
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };
  const ic: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div className="page page-narrow">
      <SubHeader title={t.account} />

      {/* Perfil */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
        {fotoSrc && fotoSrc !== fotoErrorUrl ? (
          <img src={fotoSrc} alt="" width={56} height={56} referrerPolicy="no-referrer" onError={() => setFotoErrorUrl(fotoSrc)} style={{ width: 56, height: 56, borderRadius: 16, objectFit: "cover", flexShrink: 0, border: "1px solid var(--green)44" }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 16, background: config.meta.nombre ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${config.meta.nombre ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={config.meta.nombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" /><path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke={config.meta.nombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" strokeLinecap="round" /></svg>
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{config.meta.nombre || t.user}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
        </div>
      </div>

      {/* Contraseña */}
      <button onClick={openChangePass} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
        <div style={{ ...ic, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <span style={{ fontSize: 14, flex: 1 }}>{t.changePassword}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>

      {/* Google */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={googleLinked ? undefined : handleLinkGoogle} disabled={googleLinked} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "none", border: "none", cursor: googleLinked ? "default" : "pointer", textAlign: "left", padding: 0 }}>
          <div style={{ ...ic, background: googleLinked ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${googleLinked ? "var(--green)44" : "var(--border)"}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" /></svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>{googleLinked ? t.googleLinked : t.googleLink}</div>
            {(googleErr || !googleLinked) && <div style={{ fontSize: 11, color: googleErr ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{googleErr || t.googleLinkSub}</div>}
          </div>
        </button>
        {googleLinked && <button onClick={() => setConfirmUnlink(true)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>{t.googleUnlink}</button>}
      </div>

      {/* Biometría */}
      {bioAvailable && (
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{ ...ic, background: bioEnabled ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${bioEnabled ? "var(--green)44" : "var(--border)"}` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={bioEnabled ? "var(--green)" : "var(--muted)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c0 3 0 6-1 8.5" /><path d="M8 11a4 4 0 0 1 8 0c0 3.5-.5 6-1.5 8" /><path d="M5 11a7 7 0 0 1 14 0c0 1.5 0 3-.3 4.5" /><path d="M3 9a9 9 0 0 1 4-3.5M21 9a9 9 0 0 0-4-3.5" /></svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{t.biometricUnlock}</div>
              <div style={{ fontSize: 11, color: bioError ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{bioError || t.biometricUnlockSub}</div>
            </div>
          </div>
          <Toggle activo={bioEnabled} onClick={toggleBiometric} />
        </div>
      )}

      {/* Datos: Google Sheets · Backup · Invitaciones (movido acá desde el menú principal) */}
      <button onClick={() => router.push("/settings/data")} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
        <div style={{ ...ic, background: "var(--accent-dim)", border: "1px solid var(--accent)44", color: "var(--accent)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14 }}>{t.dataSection}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{isOwner ? "Google Sheets · Backup · Invitaciones" : "Backup"}</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>

      {/* Cerrar sesión */}
      <button onClick={() => setConfirmLogout(true)} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
        <div style={{ ...ic, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <span style={{ fontSize: 14 }}>{t.signOut}</span>
      </button>


      {/* Solicitud de baja al administrador (no borra: avisa al admin). Solo invitados. */}
      {!isOwner && (
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <button onClick={() => setShowDeleteConfirm(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: "8px 0", textDecoration: "underline", textUnderlineOffset: 3 }}>
            {t.deleteAccountTitle.toLowerCase()}
          </button>
        </div>
      )}

      {showChangePass && (
        <ConfirmModal title={t.changePassword} confirmLabel={t.saveProfile} cancelLabel={t.cancel} confirmColor="var(--blue)" loading={profileBusy}
          onConfirm={savePassword} onCancel={() => { setShowChangePass(false); setPassInput(""); setCurrentPassInput(""); setProfileMsg(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="password" value={currentPassInput} onChange={(e) => setCurrentPassInput(e.target.value)} className="input" placeholder={t.currentPasswordPlaceholder} autoComplete="current-password" autoFocus />
            <div style={{ position: "relative" }}>
              <input type={passVisible ? "text" : "password"} value={passInput} onChange={(e) => setPassInput(e.target.value)} className="input" style={{ width: "100%", paddingRight: 40 }} placeholder={t.newPasswordPlaceholder} autoComplete="new-password" />
              <button onClick={() => setPassVisible(v => !v)} aria-label={passVisible ? t.hide : t.show} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)", display: "flex" }}>
                {passVisible
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.passwordHint}</div>
            {profileMsg && <div style={{ fontSize: 12, color: profileMsg.ok ? "var(--green)" : "var(--red)", lineHeight: 1.5 }}>{profileMsg.text}</div>}
          </div>
        </ConfirmModal>
      )}

      {confirmUnlink && (
        <ConfirmModal title={t.googleUnlinkTitle} confirmLabel={t.googleUnlink} cancelLabel={t.cancel} confirmColor="var(--red)"
          onConfirm={handleUnlinkGoogle} onCancel={() => setConfirmUnlink(false)}>{t.googleUnlinkBody}</ConfirmModal>
      )}

      {confirmLogout && (
        <ConfirmModal title={t.signOutTitle} confirmLabel={t.signOut} cancelLabel={t.cancel} confirmColor="var(--red)"
          onConfirm={async () => { useAppPrefs.getState().reset(); await signOut(auth); router.replace("/home"); }}
          onCancel={() => setConfirmLogout(false)}>{t.signOutBody}</ConfirmModal>
      )}

      {showDeleteConfirm && (
        <ConfirmModal title={t.deleteAccountTitle} confirmLabel={t.deleteAccountConfirm} cancelLabel={t.cancel} confirmColor="var(--red)" loading={deleteBusy}
          onConfirm={handleRequestDeletion} onCancel={() => setShowDeleteConfirm(false)}>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{t.deleteAccountBody}</div>
        </ConfirmModal>
      )}
      {deleteRequested && (
        <ConfirmModal title={t.deleteAccountSentTitle} confirmLabel={t.accept} cancelLabel="" confirmColor="var(--green)"
          onConfirm={() => setDeleteRequested(false)} onCancel={() => setDeleteRequested(false)}>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{t.deleteAccountSentBody}</div>
        </ConfirmModal>
      )}
    </div>
  );
}
