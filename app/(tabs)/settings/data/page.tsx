"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useT } from "@/hooks/useTranslation";
import { db, auth } from "@/services/firebase/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getIdToken } from "firebase/auth";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CenterCard } from "@/components/ui/CenterCard";
import { SubHeader } from "../_shared";

type SyncLog = { status: "ok" | "error"; type: "manual" | "auto"; at: Date; message: string };

export default function DataSettings() {
  const { user } = useAuth();
  const { config, movimientos } = useData();
  const t = useT();
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<{ message: string; at: Date } | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showSyncLog, setShowSyncLog] = useState(false);
  // El sync ya no es automático: el botón "Sincronizar ahora" aparece cuando el backup está
  // vencido (nunca sincronizó, o pasaron >30 días desde el último). Se recalcula solo si
  // `lastSync` cambia — leer el reloj en el cuerpo del render (en vez de en un useMemo) es
  // impuro y el compilador no puede garantizar que dos renders den el mismo resultado.
  const syncStale = useMemo(
    () => !lastSync || Date.now() - lastSync.getTime() > 30 * 24 * 60 * 60 * 1000,
    [lastSync]
  );
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const generateInviteCode = async () => {
    const u = auth.currentUser;
    if (!u || genBusy) return;
    setGenBusy(true); setCodeCopied(false);
    try {
      const token = await getIdToken(u);
      const res = await fetch("/api/invite-codes", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.code) { setInviteCode(data.code); setShowInviteModal(true); }
    } catch { /* ignore */ } finally { setGenBusy(false); }
  };
  const copyInviteCode = async () => {
    try { await navigator.clipboard.writeText(inviteCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, `users/${user.uid}/config/syncMeta`)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data?.lastSync?.toDate) setLastSync(data.lastSync.toDate());
      if (data?.lastError?.at?.toDate) setSyncError({ message: data.lastError.message, at: data.lastError.at.toDate() });
      const rawLogs: { status: "ok" | "error"; type: "manual" | "auto"; at: { toDate?: () => Date }; message: string }[] = data?.logs ?? [];
      setSyncLogs(rawLogs.map(l => ({ ...l, at: l.at?.toDate?.() ?? new Date() })));
    });
  }, [user?.uid]);

  const appendSyncLog = async (uid: string, entry: SyncLog, prev: SyncLog[]) => {
    const updated = [entry, ...prev].slice(0, 30);
    setSyncLogs(updated);
    await setDoc(doc(db, `users/${uid}/config/syncMeta`), { logs: updated }, { merge: true });
  };

  const handleSync = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setSyncing(true); setSyncMsg(null);
    try {
      const token = await getIdToken(currentUser);
      const res = await fetch("/api/sync-sheets", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.errorSyncing);
      const now = new Date();
      setLastSync(now); setSyncError(null); setSyncMsg({ ok: true, text: data.message });
      await appendSyncLog(currentUser.uid, { status: "ok", type: "manual", at: now, message: data.message ?? t.synced }, syncLogs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.errorSyncing;
      const now = new Date();
      setSyncError({ message, at: now }); setSyncMsg({ ok: false, text: message });
      await appendSyncLog(currentUser.uid, { status: "error", type: "manual", at: now, message }, syncLogs);
    } finally { setSyncing(false); setTimeout(() => setSyncMsg(null), 4000); }
  };

  const backupName = () => `finmoves_${new Date().toISOString().slice(0, 10)}.json`;
  const buildBackup = () => {
    const data = {
      version: process.env.NEXT_PUBLIC_APP_VERSION, exportedAt: new Date().toISOString(),
      movimientos: [...movimientos].sort((a, b) => a.timestampCarga.getTime() - b.timestampCarga.getTime()).map(m => ({ ...m, timestampCarga: m.timestampCarga.toISOString() })),
      config: { categorias: config?.categorias ?? [], mediosPago: config?.mediosPago ?? [], origenesAhorro: config?.origenesAhorro ?? [] },
    };
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  };

  const exportJSON = () => {
    const url = URL.createObjectURL(buildBackup());
    const a = document.createElement("a"); a.href = url; a.download = backupName(); a.click();
    URL.revokeObjectURL(url);
  };

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };
  const ic: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div className="page page-narrow">
      <SubHeader title={t.dataSection} />

      {isOwner && (
        <button onClick={() => syncLogs.length > 0 && setShowSyncLog(true)} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: syncLogs.length > 0 ? "pointer" : "default", textAlign: "left" }}>
          <div style={{ ...ic, background: syncError ? "var(--red-dim)" : lastSync ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${syncError ? "var(--red)44" : lastSync ? "var(--green)44" : "var(--border)"}` }}>
            <svg className={syncing ? "spin" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" stroke={syncError ? "var(--red)" : lastSync ? "var(--green)" : "var(--muted)"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14 }}>Google Sheets</div>
            <div style={{ fontSize: 11, marginTop: 2, color: syncError ? "var(--red)" : lastSync ? "var(--green)" : "var(--muted)" }}>
              {syncError ? t.syncErrorMsg(syncError.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }))
                : lastSync ? t.lastSyncMsg(lastSync.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }))
                : t.neverSynced}
            </div>
          </div>
          {/* Botón de sincronizar: al haber error (rojo, reintentar) o cuando el backup está
              VENCIDO — >30 días desde el último sync, o nunca (el sync ya no es automático). */}
          {(syncError || syncStale) && (
            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); if (!syncing) handleSync(); }} style={{
              flexShrink: 0, borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: syncing ? "default" : "pointer",
              ...(syncError
                ? { background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)44" }
                : { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)44" }),
            }}>
              {syncing ? t.syncing : syncError ? t.retry : t.syncNow}
            </span>
          )}
        </button>
      )}

      <button onClick={() => setShowExportConfirm(true)} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
        <div style={{ ...ic, background: "var(--accent-dim)", border: "1px solid var(--accent)44", color: "var(--accent)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14 }}>Backup</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.exportJSON}</div>
        </div>
      </button>

      {isOwner && (
        <button onClick={generateInviteCode} disabled={genBusy} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: genBusy ? "default" : "pointer", textAlign: "left" }}>
          <div style={{ ...ic, background: "var(--accent-dim)", border: "1px solid var(--accent)44", color: "var(--accent)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <span style={{ fontSize: 14, color: genBusy ? "var(--muted)" : "var(--text)" }}>{genBusy ? t.generatingInvite : t.generateInvite}</span>
        </button>
      )}

      <CenterCard open={showInviteModal} onClose={() => setShowInviteModal(false)} title={t.inviteCodeModalTitle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--accent-dim)", border: "1px solid var(--accent)44", borderRadius: 14, padding: "16px 18px" }}>
          <span style={{ flex: 1, fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: 4, color: "var(--accent)", textAlign: "center" }}>{inviteCode}</span>
          <button onClick={copyInviteCode} aria-label={t.copy} style={{ background: codeCopied ? "var(--green-dim)" : "var(--surface)", border: `1px solid ${codeCopied ? "var(--green)" : "var(--border)"}`, borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: codeCopied ? "var(--green)" : "var(--muted)", flexShrink: 0 }}>
            {codeCopied
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
          </button>
        </div>
      </CenterCard>

      <CenterCard open={showSyncLog} onClose={() => setShowSyncLog(false)} title={t.syncHistory} maxWidth={420}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {syncLogs.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 24 }}>{t.noRecords}</div>
            : syncLogs.map((log, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", borderRadius: "var(--radius-sm)", background: log.status === "ok" ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${log.status === "ok" ? "var(--green)33" : "var(--red)33"}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4, background: log.status === "ok" ? "var(--green)" : "var(--red)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: log.status === "ok" ? "var(--green)" : "var(--red)" }}>{log.message}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, display: "flex", gap: 8 }}>
                    <span>{log.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" })}</span>
                    <span style={{ padding: "1px 6px", borderRadius: 4, background: log.type === "auto" ? "var(--blue-dim)" : "var(--surface-alt)", color: log.type === "auto" ? "var(--blue)" : "var(--muted)", border: `1px solid ${log.type === "auto" ? "var(--blue)33" : "var(--border)"}`, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{log.type === "auto" ? "Auto" : "Manual"}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </CenterCard>

      {showExportConfirm && (
        <ConfirmModal title="Backup" confirmLabel={t.download} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { exportJSON(); setShowExportConfirm(false); }} onCancel={() => setShowExportConfirm(false)}>{t.exportJSONBody}</ConfirmModal>
      )}

      {syncMsg && <div className="fade-up" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)", zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, background: syncMsg.ok ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${syncMsg.ok ? "var(--green)" : "var(--red)"}44`, color: syncMsg.ok ? "var(--green)" : "var(--red)", textAlign: "center", backdropFilter: "blur(8px)" }}>{syncMsg.text}</div>}
    </div>
  );
}
