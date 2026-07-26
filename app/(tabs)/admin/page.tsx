"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { auth } from "@/services/firebase/firebase";
import { getIdToken } from "firebase/auth";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { UsersTable } from "@/components/desktop/UsersTable";

type AdminUser = {
  uid: string; email: string; nombre: string;
  createdAt: string; lastSignIn: string;
  pushOn: boolean; permisos: Record<string, boolean>;
  inviteCode: string | null; isOwner: boolean;
};
type AdminCode = { code: string; createdAt: number };

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  // En pantalla ancha los usuarios van como tabla con los permisos en columnas.
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (user && !isOwner) router.replace("/");
  }, [user, isOwner, router]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [pendingPerm, setPendingPerm] = useState<{ uid: string; key: string; value: boolean; label: string; nombre: string } | null>(null);
  const [permMotivo, setPermMotivo] = useState<"Fix" | "Bug" | "Error" | null>(null);
  const [permBusy, setPermBusy] = useState(false);
  const [permMsg, setPermMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const u = auth.currentUser;
    if (!u) return;
    setLoading(true);
    try {
      const token = await getIdToken(u);
      const h = { Authorization: `Bearer ${token}` };
      const [ru, rc] = await Promise.all([
        fetch("/api/admin/users", { headers: h }),
        fetch("/api/invite-codes", { headers: h }),
      ]);
      const du = await ru.json(); const dc = await rc.json();
      if (ru.ok) setUsers(du.users ?? []);
      if (rc.ok) setCodes(dc.codes ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { if (isOwner) load(); }, [isOwner]);

  const generateCode = async () => {
    const u = auth.currentUser;
    if (!u || genBusy) return;
    setGenBusy(true); setCodeCopied(false);
    try {
      const token = await getIdToken(u);
      const res = await fetch("/api/invite-codes", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.code) {
        setInviteCode(data.code);
        setCodes((prev) => [{ code: data.code, createdAt: Date.now() }, ...prev]);
      }
    } catch { /* ignore */ } finally { setGenBusy(false); }
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } catch { /* ignore */ }
  };

  const delCode = async (code: string) => {
    const u = auth.currentUser;
    if (!u) return;
    setCodes((prev) => prev.filter((c) => c.code !== code));
    try {
      const token = await getIdToken(u);
      await fetch("/api/invite-codes", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
    } catch { /* ignore */ }
  };

  const setPermission = async (targetUid: string, key: string, value: boolean, motivo?: string) => {
    const u = auth.currentUser;
    if (!u || permBusy) return;
    setPermBusy(true);
    setUsers((prev) => prev.map((x) => x.uid === targetUid ? { ...x, permisos: { ...x.permisos, [key]: value } } : x));
    try {
      const token = await getIdToken(u);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uid: targetUid, key, value, motivo }),
      });
      if (!res.ok) throw new Error("error");
      setPermMsg({ ok: true, text: "Permiso actualizado" });
    } catch {
      setUsers((prev) => prev.map((x) => x.uid === targetUid ? { ...x, permisos: { ...x.permisos, [key]: !value } } : x));
      setPermMsg({ ok: false, text: "No se pudo actualizar" });
    } finally {
      setPermBusy(false); setPendingPerm(null); setPermMotivo(null);
      setTimeout(() => setPermMsg(null), 3000);
    }
  };

  if (!isOwner) return null;

  // Con la tabla de usuarios (escritorio) hace falta ancho; en móvil, la columna angosta de
  // siempre porque son cards apiladas.
  return (
    <div className={`page ${isDesktop ? "page-fluid" : "page-narrow"}`}>
      <div style={{ marginBottom: 24 }}>
        <div className="label">administración</div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Panel</div>
      </div>

      {/* Invite codes */}
      <div className="soft" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>códigos de invitación</span>
          <button onClick={generateCode} disabled={genBusy} style={{
            fontSize: 11, fontWeight: 700, color: "var(--accent)",
            background: "var(--accent-dim)", border: "1px solid var(--accent)44",
            borderRadius: 999, padding: "4px 12px", cursor: genBusy ? "default" : "pointer",
          }}>
            {genBusy ? "…" : "+ generar"}
          </button>
        </div>

        {inviteCode && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--accent-dim)", border: "1px solid var(--accent)44", marginBottom: 12 }}>
            <span style={{ flex: 1, fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: 4, color: "var(--accent)" }}>{inviteCode}</span>
            <button onClick={() => copyCode(inviteCode)} style={{ background: "none", border: "none", cursor: "pointer", color: codeCopied ? "var(--green)" : "var(--accent)", fontSize: 12, fontWeight: 700 }}>
              {codeCopied ? "copiado" : "copiar"}
            </button>
          </div>
        )}

        {codes.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 12 }}>sin códigos activos</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {codes.map((c) => (
              <div key={c.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--faint)" }}>
                <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: 2, color: "var(--accent)" }}>{c.code}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => copyCode(c.code)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11 }}>copiar</button>
                  <button onClick={() => delCode(c.code)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="soft">
        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>usuarios</div>
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>…</div>
        ) : users.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>sin usuarios</div>
        ) : isDesktop ? (
          /* Escritorio: los permisos entran como columnas de toggles, así se ve quién tiene
             qué sin abrir un acordeón por usuario. */
          <UsersTable
            users={users}
            onTogglePerm={(u, key, label, value) => setPendingPerm({ uid: u.uid, key, value, label, nombre: u.nombre || u.email })}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {users.map((u) => (
              <div key={u.uid}>
                <button onClick={() => setSelectedUid(selectedUid === u.uid ? null : u.uid)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 0", background: "none", border: "none",
                  borderBottom: "1px solid var(--faint)", cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: u.pushOn ? "var(--green)" : "var(--border)", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                    {u.nombre || u.email}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{u.email}</span>
                  {u.isOwner && <span className="badge" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)44" }}>owner</span>}
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{selectedUid === u.uid ? "▲" : "▼"}</span>
                </button>

                {selectedUid === u.uid && (
                  <div style={{ padding: "12px 0 16px", borderBottom: "1px solid var(--faint)" }}>
                    <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>última conexión</div>
                        <div style={{ fontSize: 12 }}>
                          {u.pushOn
                            ? <span style={{ color: "var(--green)" }}>online</span>
                            : u.lastSignIn ? new Date(u.lastSignIn).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>creado</div>
                        <div style={{ fontSize: 12 }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                        </div>
                      </div>
                    </div>

                    {!u.isOwner && (
                      <>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>permisos</div>
                        {([["comprobantes", "Imágenes"], ["inversion", "Inversión"]] as const).map(([key, label]) => {
                          const on = u.permisos[key] === true;
                          return (
                            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                              <span style={{ fontSize: 13 }}>{label}</span>
                              <button onClick={() => setPendingPerm({ uid: u.uid, key, value: !on, label, nombre: u.nombre || u.email })} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                <span style={{ width: 34, height: 19, borderRadius: 999, background: on ? "var(--green)" : "var(--surface-alt)", border: `1px solid ${on ? "var(--green)" : "var(--border)"}`, position: "relative", display: "block" }}>
                                  <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                                </span>
                              </button>
                            </div>
                          );
                        })}
                        {permMsg && selectedUid === u.uid && (
                          <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 12, background: permMsg.ok ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${permMsg.ok ? "var(--green)44" : "var(--red)44"}`, color: permMsg.ok ? "var(--green)" : "var(--red)" }}>
                            {permMsg.text}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm perm modal */}
      {pendingPerm && (
        <div onClick={() => setPendingPerm(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 380, padding: "24px 20px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{pendingPerm.value ? "Activar" : "Desactivar"} permiso</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
              <strong>{pendingPerm.label}</strong> para <strong>{pendingPerm.nombre}</strong>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 10 }}>Motivo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["Fix", "Bug", "Error"] as const).map((m) => (
                  <button key={m} onClick={() => setPermMotivo(m)} style={{
                    padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${permMotivo === m ? "var(--blue)" : "var(--border)"}`,
                    background: permMotivo === m ? "var(--blue-dim)" : "transparent",
                    color: permMotivo === m ? "var(--blue)" : "var(--text)",
                    fontSize: 13, fontWeight: permMotivo === m ? 700 : 500,
                    cursor: "pointer", textAlign: "left",
                  }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPendingPerm(null)} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--text)" }}>
                Cancelar
              </button>
              <button onClick={() => permMotivo && setPermission(pendingPerm.uid, pendingPerm.key, pendingPerm.value, permMotivo)}
                disabled={!permMotivo || permBusy}
                style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: permMotivo ? (pendingPerm.value ? "var(--green)" : "var(--red)") : "var(--surface-alt)", color: permMotivo ? "var(--bg)" : "var(--muted)", fontSize: 13, fontWeight: 700, cursor: permMotivo ? "pointer" : "default", opacity: permBusy ? 0.5 : 1 }}>
                {permBusy ? "…" : pendingPerm.value ? "Activar" : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
