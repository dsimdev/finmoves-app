"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useT } from "@/hooks/useTranslation";
import { db } from "@/services/firebase/firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { dbErrorMessage } from "@/lib/firebase-error";
import type { ConfigUsuario } from "@/types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CategoriaIcono, CategoriaGlifo } from "@/components/ui/CategoriaIcono";
import { visualDeCategoria, ICONOS_LISTA, COLORES_LISTA, COLORES_CATEGORIA } from "@/utils/categoria-visual";
import { validarRename } from "@/utils/rename-categoria";
import { renombrarCategoria, eliminarCategoria } from "@/services/firebase/rename-categoria";
import { balancePresupuesto } from "@/utils/presupuesto-tope";
import { agruparPorPeriodo } from "@/utils/periodo";
import { useMoney } from "@/hooks/useHideValues";
import { Toggle, SubHeader } from "../_shared";

// Fila editable: nombre + switch activar/desactivar + borrar.
function ItemRow({ name, dot, icon, activo, onToggle, onDelete }: { name: string; dot?: string; icon?: React.ReactNode; activo: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: "1px solid var(--faint)" }}>
      {/* Las categorías traen su ícono (tocable, elige ícono y color); medios y orígenes
          siguen con el punto de color simple. */}
      {icon
        ? <span style={{ flexShrink: 0, opacity: activo ? 1 : 0.4 }}>{icon}</span>
        : <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, opacity: activo ? 1 : 0.4 }} />}
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: activo ? 1 : 0.5 }}>{name}</span>
      <Toggle activo={activo} onClick={onToggle} />
      <button onClick={onDelete} aria-label="Eliminar" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  );
}

export default function MovementsSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh, refresh: refreshMovimientos, movimientos, loading: movsLoading } = useData();
  const t = useT();
  const { oculto, m: money } = useMoney();

  // Último sueldo conocido (período más reciente con sueldo > 0), para el aviso BLANDO del
  // template. El template es genérico (no vive en un período), así que solo se avisa, no bloquea.
  const ultimoSueldo = useMemo(() => {
    for (const p of agruparPorPeriodo(movimientos)) if (p.sueldo > 0) return p.sueldo;
    return 0;
  }, [movimientos]);

  const [guardando, setGuardando] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [movSub, setMovSub] = useState<"categorias" | "medios" | "origenes">("categorias");
  const [pendingDelete, setPendingDelete] = useState<{ kind: "cat" | "med" | "ori"; nombre: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [localCats, setLocalCats] = useState<ConfigUsuario["categorias"]>([]);
  const [localMedios, setLocalMedios] = useState<ConfigUsuario["mediosPago"]>([]);
  const [localOrigenes, setLocalOrigenes] = useState<ConfigUsuario["origenesAhorro"]>([]);
  const catsRef = useRef<ConfigUsuario["categorias"]>([]);
  const mediosRef = useRef<ConfigUsuario["mediosPago"]>([]);
  const origRef = useRef<ConfigUsuario["origenesAhorro"]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (config && !didInit.current) {
      setLocalCats(config.categorias); setLocalMedios(config.mediosPago); setLocalOrigenes(config.origenesAhorro);
      catsRef.current = config.categorias; mediosRef.current = config.mediosPago; origRef.current = config.origenesAhorro;
      didInit.current = true;
    }
  }, [config]);

  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try { await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig); refresh(); }
    catch (err) { setSaveMsg({ ok: false, text: dbErrorMessage(err, t) }); setTimeout(() => setSaveMsg(null), 3000); }
    finally { setGuardando(false); }
  };
  const persist = () => { if (!config) return; saveConfig({ ...config, categorias: catsRef.current, mediosPago: mediosRef.current, origenesAhorro: origRef.current }); };
  const scheduleSave = () => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(persist, 1200); };

  const toggleCat = (n: string) => { const next = catsRef.current.map(c => c.nombre === n ? { ...c, activa: !c.activa } : c); catsRef.current = next; setLocalCats(next); scheduleSave(); };
  // Categoría cuyo ícono/color/nombre se está editando (nombre), o null si está cerrado.
  const [editandoVisual, setEditandoVisual] = useState<string | null>(null);
  const catEditando = localCats.find((c) => c.nombre === editandoVisual) ?? null;
  const setVisual = (nombre: string, patch: { icono?: string; color?: string }) => {
    const next = catsRef.current.map(c => c.nombre === nombre ? { ...c, ...patch } : c);
    catsRef.current = next; setLocalCats(next); scheduleSave();
  };

  // Renombrar la categoría abierta. El nombre lo referencian los movimientos, el presupuesto y
  // los recurrentes: renombrarCategoria migra todo eso (ver services/firebase/rename-categoria).
  // Es una migración, así que se confirma antes de escribir.
  const [renameInput, setRenameInput] = useState("");
  const [renameConfirm, setRenameConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  useEffect(() => { setRenameInput(editandoVisual ?? ""); }, [editandoVisual]);
  const renameCheck = catEditando ? validarRename(catEditando.nombre, renameInput, localCats.map((c) => c.nombre)) : { ok: false as const, motivo: "vacio" as const };
  // Conteo para el diálogo, del cache. Es solo informativo: la migración lee del servidor, así
  // que aunque el cache esté frío (count 0) el rename igual migra todo. Por eso null = "cargando"
  // y no "0", para no mentir con un número.
  const movsAfectados = catEditando && !movsLoading
    ? movimientos.filter((m) => m.categoria === catEditando.nombre).length
    : null;
  const doRename = async () => {
    if (!user?.uid || !config || !catEditando || !renameCheck.ok || renaming) return;
    const actual = catEditando.nombre, nuevo = renameInput.trim();
    setRenaming(true);
    try {
      // El servicio lee movimientos y recurrentes del SERVIDOR (no del cache del cliente), así
      // que migra bien aunque acá el cache todavía no haya cargado.
      await renombrarCategoria(user.uid, actual, nuevo, config);
      refresh();             // config (nombre + presupuesto)
      refreshMovimientos();  // invalida el cache de movimientos → re-fetch con la categoría nueva
      // Reflejar el rename en el estado local (la config se re-hidrata, pero didInit ya corrió).
      const next = catsRef.current.map((c) => (c.nombre === actual ? { ...c, nombre: nuevo } : c));
      catsRef.current = next; setLocalCats(next);
      setRenameConfirm(null); setEditandoVisual(null);
    } catch (err) { setSaveMsg({ ok: false, text: dbErrorMessage(err, t) }); setTimeout(() => setSaveMsg(null), 3000); setRenameConfirm(null); }
    finally { setRenaming(false); }
  };
  const toggleMed = (n: string) => { const next = mediosRef.current.map(m => m.nombre === n ? { ...m, activo: !m.activo } : m); mediosRef.current = next; setLocalMedios(next); scheduleSave(); };
  const toggleOri = (n: string) => { const next = origRef.current.map(o => o.nombre === n ? { ...o, activo: !o.activo } : o); origRef.current = next; setLocalOrigenes(next); scheduleSave(); };

  // Borrar categoría: a diferencia de medios/orígenes (mutación local + persist genérico), usa
  // el servicio dedicado — limpia también la key del presupuestoTemplate y desactiva los
  // recurrentes que la referenciaban (si no, "Games" borrada seguía apareciendo en Presupuesto
  // y sus recordatorios seguían disparando).
  const [deletingCat, setDeletingCat] = useState(false);
  const delCat = async (n: string) => {
    if (!user?.uid || !config) return;
    setDeletingCat(true);
    try {
      await eliminarCategoria(user.uid, n, config);
      const next = catsRef.current.filter(c => c.nombre !== n);
      catsRef.current = next; setLocalCats(next);
      refresh();
      setPendingDelete(null);
    } catch (err) { setSaveMsg({ ok: false, text: dbErrorMessage(err, t) }); setTimeout(() => setSaveMsg(null), 3000); }
    finally { setDeletingCat(false); }
  };
  const delMed = (n: string) => { const next = mediosRef.current.filter(m => m.nombre !== n); mediosRef.current = next; setLocalMedios(next); setPendingDelete(null); persist(); };
  const delOri = (n: string) => { const next = origRef.current.filter(o => o.nombre !== n); origRef.current = next; setLocalOrigenes(next); setPendingDelete(null); persist(); };
  const confirmDelete = () => { if (!pendingDelete) return; if (pendingDelete.kind === "cat") delCat(pendingDelete.nombre); else if (pendingDelete.kind === "med") delMed(pendingDelete.nombre); else delOri(pendingDelete.nombre); };

  const agregar = () => {
    const nombre = nuevoNombre.trim();
    if (!nombre || !config) return;
    if (movSub === "categorias") { const next = [...catsRef.current, { id: nombre, nombre, tipo: nuevoTipo, activa: true }]; catsRef.current = next; setLocalCats(next); }
    else if (movSub === "medios") { const next = [...mediosRef.current, { id: nombre, nombre, activo: true }]; mediosRef.current = next; setLocalMedios(next); }
    else { const next = [...origRef.current, { id: nombre, nombre, activo: true }]; origRef.current = next; setLocalOrigenes(next); }
    setNuevoNombre(""); persist();
  };

  // Presupuesto (template por categoría) — fusionado desde la antigua sección Presupuestos.
  const [localTemplate, setLocalTemplate] = useState<Record<string, string>>({});
  const [templateSaving, setTemplateSaving] = useState(false);
  useEffect(() => {
    if (!config) return;
    const tpl = config.meta.presupuestoTemplate ?? {};
    setLocalTemplate(Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, String(v)])));
  }, [!!config]);
  const templateIsDirty = useMemo(() => {
    const saved = config?.meta.presupuestoTemplate ?? {};
    const activeCats = (config?.categorias ?? []).filter((c) => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos"));
    return activeCats.some((c) => Math.round(parseFloat(localTemplate[c.nombre] ?? "") || 0) !== Math.round(saved[c.nombre] ?? 0));
  }, [localTemplate, config?.meta.presupuestoTemplate, config?.categorias]);
  const saveTemplate = async () => {
    if (!user?.uid || !config) return;
    setTemplateSaving(true);
    try {
      const categorias: Record<string, number> = {};
      for (const [cat, val] of Object.entries(localTemplate)) { const n = parseFloat(val); if (!isNaN(n) && n > 0) categorias[cat] = n; }
      await updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.presupuestoTemplate": categorias });
      refresh();
    } finally { setTemplateSaving(false); }
  };

  if (!config) return null;
  const presupuestoCats = config.categorias.filter((c) => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos"));
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };
  const subs = [{ id: "categorias", label: t.categories }, { id: "medios", label: t.methods }, { id: "origenes", label: t.originsLabel }] as const;
  const closeAdd = () => { setAdding(false); setNuevoNombre(""); };

  return (
    <div className="page page-narrow">
      <SubHeader title={t.settingsTabMovements} />

      <div style={card}>
        {/* Selector de sub-lista */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {subs.map(s => (
            <button key={s.id} onClick={() => { setMovSub(s.id); closeAdd(); }} className="pill" style={{
              flex: 1, borderColor: movSub === s.id ? "var(--accent)" : "var(--border)", background: movSub === s.id ? "var(--accent-dim)" : "transparent", color: movSub === s.id ? "var(--accent)" : "var(--muted)",
            }}>{s.label}</button>
          ))}
        </div>

        {/* Alta inline (se abre con el botón Agregar) */}
        {adding ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, padding: 12, background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border)" }}>
            {movSub === "categorias" && (
              <div style={{ display: "flex", gap: 6 }}>
                {(["Gasto", "Ingreso"] as const).map(tipo => (
                  <button key={tipo} onClick={() => setNuevoTipo(tipo)} className="pill" style={{
                    flex: 1, borderColor: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--border)",
                    background: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)") : "transparent",
                    color: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--muted)",
                  }}>{tipo === "Gasto" ? t.expenseType : t.incomeType}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter") agregar(); }}
                placeholder={movSub === "categorias" ? t.newCategory : movSub === "medios" ? t.newMethod : t.newOrigin} className="input" style={{ flex: 1 }} />
              <button onClick={agregar} disabled={!nuevoNombre.trim()} aria-label={t.add} style={{ flexShrink: 0, width: 44, borderRadius: "var(--radius-sm)", border: "none", background: nuevoNombre.trim() ? "var(--green)" : "var(--surface)", color: nuevoNombre.trim() ? "var(--bg)" : "var(--muted)", cursor: nuevoNombre.trim() ? "pointer" : "default", fontSize: 22, lineHeight: 1 }}>+</button>
              <button onClick={closeAdd} aria-label={t.cancel} style={{ flexShrink: 0, width: 44, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px 0", marginBottom: 8, borderRadius: 10, border: "1px dashed var(--border-hi)", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t.add}
          </button>
        )}

        {/* Lista */}
        {movSub === "origenes" && <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>{t.shownWhenAddingIncomeSavings}</div>}
        {/* El "dot" de la categoría es su ÍCONO: se toca para elegir ícono y color. El punto
            de tipo (gasto/ingreso) ya no hace falta acá — las categorías vienen agrupadas. */}
        {movSub === "categorias" && [...localCats].sort((a, b) => a.tipo === b.tipo ? 0 : a.tipo === "Gasto" ? -1 : 1).map(c => (
          <ItemRow
            key={c.nombre}
            name={c.nombre}
            icon={<button type="button" onClick={() => setEditandoVisual(c.nombre)} aria-label={t.chooseIconColor} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}><CategoriaIcono categoria={c} size={30} /></button>}
            activo={c.activa}
            onToggle={() => toggleCat(c.nombre)}
            onDelete={() => setPendingDelete({ kind: "cat", nombre: c.nombre })}
          />
        ))}
        {movSub === "medios" && localMedios.map(m => (
          <ItemRow key={m.nombre} name={m.nombre} dot="var(--blue)" activo={m.activo} onToggle={() => toggleMed(m.nombre)} onDelete={() => setPendingDelete({ kind: "med", nombre: m.nombre })} />
        ))}
        {movSub === "origenes" && localOrigenes.map(o => (
          <ItemRow key={o.nombre} name={o.nombre} dot="var(--green)" activo={o.activo} onToggle={() => toggleOri(o.nombre)} onDelete={() => setPendingDelete({ kind: "ori", nombre: o.nombre })} />
        ))}
      </div>

      {/* Presupuesto (template por categoría) */}
      <div style={card}>
        <div className="label" style={{ marginBottom: 4 }}>{t.budgetTemplate}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 16 }}>{t.budgetTemplateSub}</div>

        {/* Indicador BLANDO contra el último sueldo conocido: barra + remanente. No bloquea el
            guardado (el template es genérico, no vive en un período); solo orienta. */}
        {(() => {
          const montos: Record<string, number> = {};
          for (const [cat, val] of Object.entries(localTemplate)) { const n = parseFloat(val); if (!isNaN(n) && n > 0) montos[cat] = n; }
          const bal = balancePresupuesto(montos, ultimoSueldo);
          if (bal.sueldo === 0) return null; // sin sueldo histórico, no hay referencia
          const pct = Math.min(100, Math.round(bal.fraccion * 100));
          const colorBarra = bal.excede ? "var(--red)" : bal.fraccion > 0.9 ? "var(--yellow)" : "var(--green)";
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                {t.budgetDistributed} <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: 600 }}>{oculto ? "••" : money(bal.distribuido)}</span> {t.budgetOfIncome(oculto ? "••" : money(bal.sueldo))}
              </div>
              <div style={{ height: 8, borderRadius: 6, background: "var(--faint)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: colorBarra, transition: "width .3s ease, background .2s" }} />
              </div>
              {bal.excede && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--red)", fontWeight: 600 }}>{t.budgetTemplateOverLast(oculto ? "••" : money(bal.sueldo))}</div>
              )}
            </div>
          );
        })()}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {presupuestoCats.map((c) => (
            <div key={c.nombre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{c.nombre}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--muted)", pointerEvents: "none" }}>$</span>
                <input type="number" inputMode="numeric" value={localTemplate[c.nombre] ?? ""} onChange={(e) => setLocalTemplate((prev) => ({ ...prev, [c.nombre]: e.target.value }))} placeholder="0" className="input" style={{ width: 130, paddingLeft: 22, textAlign: "right", fontFamily: "var(--font-mono)" }} />
              </div>
            </div>
          ))}
        </div>
        <button onClick={saveTemplate} disabled={templateSaving || !templateIsDirty} style={{ width: "100%", padding: "12px 0", borderRadius: "var(--radius-sm)", background: "var(--accent)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: (templateSaving || !templateIsDirty) ? "default" : "pointer", opacity: (templateSaving || !templateIsDirty) ? 0.35 : 1 }}>
          {templateSaving ? "…" : t.save}
        </button>
      </div>

      {/* Ícono y color de una categoría. Se elige tocando: sin campos de texto ni códigos.
          Los colores ofrecidos NO incluyen los semánticos de tipo (ver utils/categoria-visual). */}
      <BottomSheet open={!!catEditando} onClose={() => setEditandoVisual(null)} title={t.chooseIconColor}>
        {catEditando && (() => {
          const actual = visualDeCategoria(catEditando);
          return (
            <div style={{ paddingBottom: 10 }}>
              {/* Nombre editable. Renombrar migra los movimientos + presupuesto + recurrentes,
                  así que se confirma antes de escribir (es una migración, no un tweak). */}
              <div className="label" style={{ marginBottom: 8 }}>{t.categoryName}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && renameCheck.ok) setRenameConfirm(catEditando.nombre); }}
                  className="input" style={{ flex: 1 }} aria-label={t.categoryName}
                />
                <button
                  type="button"
                  onClick={() => setRenameConfirm(catEditando.nombre)}
                  disabled={!renameCheck.ok}
                  style={{ flexShrink: 0, padding: "0 16px", borderRadius: "var(--radius-sm)", border: "none", fontSize: 13, fontWeight: 700, cursor: renameCheck.ok ? "pointer" : "default", background: renameCheck.ok ? "var(--accent)" : "var(--surface-alt)", color: renameCheck.ok ? "#fff" : "var(--muted)" }}
                >{t.renameSave}</button>
              </div>
              {/* Solo el choque de nombres se avisa; vacío o sin-cambio simplemente deshabilitan. */}
              <div style={{ minHeight: 16, marginBottom: 16, fontSize: 11, color: "var(--red)" }}>
                {!renameCheck.ok && renameCheck.motivo === "duplicado" ? t.renameDuplicate : ""}
              </div>

              {/* Vista previa de cómo va a quedar en la lista. */}
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", marginBottom: 18, background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                <CategoriaIcono categoria={catEditando} size={34} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{t.exampleMovement}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{catEditando.nombre}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: catEditando.tipo === "Gasto" ? "var(--red)" : "var(--green)" }}>
                  {catEditando.tipo === "Gasto" ? "-" : "+"}$8.400
                </span>
              </div>

              <div className="label" style={{ marginBottom: 10 }}>{t.icon}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 20 }}>
                {ICONOS_LISTA.map((ic) => {
                  const sel = actual.icono === ic;
                  return (
                    <button key={ic} type="button" onClick={() => setVisual(catEditando.nombre, { icono: ic })} aria-label={ic} aria-pressed={sel}
                      style={{
                        aspectRatio: "1", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                        background: sel ? `color-mix(in srgb, ${actual.hex} 18%, transparent)` : "var(--surface-alt)",
                        border: `1px solid ${sel ? actual.hex : "var(--border)"}`,
                        color: sel ? actual.hex : "var(--muted)", transition: "background .12s, border-color .12s",
                      }}>
                      <CategoriaGlifo icono={ic} size={19} />
                    </button>
                  );
                })}
              </div>

              <div className="label" style={{ marginBottom: 10 }}>{t.color}</div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                {COLORES_LISTA.map((col) => {
                  const hex = COLORES_CATEGORIA[col];
                  const sel = actual.color === col;
                  return (
                    <button key={col} type="button" onClick={() => setVisual(catEditando.nombre, { color: col })} aria-label={col} aria-pressed={sel}
                      style={{
                        width: 32, height: 32, borderRadius: 10, background: hex, cursor: "pointer",
                        // El "contraste" toma el color del texto: sobre la superficie casi se
                        // funde, así que lleva un borde tenue para que se vea el swatch.
                        border: sel
                          ? "2px solid var(--accent)"
                          : `2px solid ${col === "contraste" ? "var(--border-hi)" : "transparent"}`,
                        transition: "transform .12s",
                      }} />
                  );
                })}
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      {renameConfirm && catEditando && (
        <ConfirmModal title={t.renameConfirmTitle} confirmLabel={renaming ? "…" : t.renameSave} cancelLabel={t.cancel} onConfirm={doRename} onCancel={() => setRenameConfirm(null)}>
          <div style={{ textAlign: "center" }}>{t.renameConfirmBody(catEditando.nombre, renameInput.trim(), movsAfectados)}</div>
        </ConfirmModal>
      )}

      {pendingDelete && (
        <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)" loading={pendingDelete.kind === "cat" && deletingCat} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{pendingDelete.nombre}</div>
            <div>{t.actionIrreversible}</div>
          </div>
        </ConfirmModal>
      )}

      {saveMsg && (
        <div className="fade-up" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)", zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, background: saveMsg.ok ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${saveMsg.ok ? "var(--green)" : "var(--red)"}44`, color: saveMsg.ok ? "var(--green)" : "var(--red)", textAlign: "center", backdropFilter: "blur(8px)" }}>{saveMsg.text}</div>
      )}
    </div>
  );
}
