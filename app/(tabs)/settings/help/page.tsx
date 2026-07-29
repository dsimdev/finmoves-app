"use client";

import { useState, useEffect } from "react";
import { useT } from "@/hooks/useTranslation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SubHeader } from "../_shared";
import { GUIDE, type GuideSection } from "@/locales/guide";

const CHANGELOG_WEB_URL = "https://github.com/dsimdev/finmoves.app/blob/main/CHANGELOG_USER.md";

const boldify = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
  part.startsWith("**") && part.endsWith("**") ? <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong> : part
);

// Íconos por sección (stroke currentColor).
const ICONS: Record<string, React.ReactNode> = {
  compass: <><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  piggy: <><path d="M19 8a4 4 0 0 0-4-4H9a5 5 0 0 0-5 5v3a4 4 0 0 0 2 3.46V19h3v-2h2v2h3v-2.54A4 4 0 0 0 20 12v-1h-1" /><circle cx="15" cy="10" r=".5" fill="currentColor" /></>,
  hand: <><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13" /></>,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
};

function Section({ section }: { section: GuideSection }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 15px 10px" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${section.color} 15%, transparent)`, color: section.color }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{ICONS[section.icon]}</svg>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{section.title}</div>
      </div>
      <div>
        {section.items.map((it, i) => {
          const abierto = open === i;
          return (
            <div key={i} style={{ borderTop: "1px solid var(--faint)" }}>
              <button onClick={() => setOpen(abierto ? null : i)} aria-expanded={abierto} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 15px",
                background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text)",
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{it.q}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {abierto && (
                <div style={{ padding: "0 15px 14px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65 }}>{boldify(it.a)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HelpSettings() {
  const t = useT();
  const lang = useAppPrefs((s) => s.lang);
  const secciones = GUIDE[lang] ?? GUIDE.es;
  const [changelog, setChangelog] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showGithubConfirm, setShowGithubConfirm] = useState(false);

  const openChangelog = async () => {
    if (!changelog) { const res = await fetch("/api/changelog"); setChangelog(await res.text()); }
    setShowChangelog(true);
  };
  // Deep-link ?changelog=1: reacciona a la URL (un sistema externo), el uso de efecto que
  // React documenta como correcto — no deriva estado de props/deps que se pueda calcular en
  // render.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("changelog") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openChangelog();
      window.history.replaceState(null, "", "/settings/help");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page page-narrow">
      <SubHeader title={t.guideSection} />

      <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 4px 16px" }}>{t.guideIntro}</p>

      {secciones.map((s) => <Section key={s.id} section={s} />)}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 36, padding: "18px 0 4px" }}>
        <button onClick={() => setShowGithubConfirm(true)} aria-label="GitHub" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          <span style={{ fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>GitHub</span>
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>v{process.env.NEXT_PUBLIC_APP_VERSION}</div>
          <button onClick={openChangelog} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: 0, textDecoration: "underline" }}>changelog</button>
        </div>
      </div>

      <BottomSheet open={showChangelog} onClose={() => setShowChangelog(false)} title="Changelog">
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)" }}>
          {changelog ? (() => {
            const all = changelog.split("\n"); const top: string[] = []; let versions = 0;
            for (const line of all) { if (line.startsWith("## [")) { versions++; if (versions > 5) break; } top.push(line); }
            return top;
          })().map((line, i) => {
            if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 14, fontWeight: 700, margin: "16px 0 4px", color: "var(--blue)" }}>{line.replace(/^## /, "")}</div>;
            if (line.startsWith("### ")) return <div key={i} style={{ fontSize: 11, fontWeight: 600, margin: "10px 0 2px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{line.replace(/^### /, "")}</div>;
            if (line.startsWith("- ")) return <div key={i} style={{ paddingLeft: 10, marginBottom: 3 }}>• {boldify(line.replace(/^- /, ""))}</div>;
            if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />;
            if (line.startsWith("# ") || line.trim() === "" || line.startsWith("Todos los cambios") || line.startsWith("Formato basado") || line.startsWith("https://keep")) return null;
            return <div key={i}>{boldify(line)}</div>;
          }) : <div style={{ color: "var(--muted)" }}>Loading…</div>}
          <button onClick={() => setConfirmLeave(true)} aria-label={t.viewFullChangelog} title={t.viewFullChangelog} style={{ display: "block", width: "100%", textAlign: "center", margin: "20px auto 2px", background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontStyle: "italic", cursor: "pointer" }}>{t.seeMore}</button>
        </div>
      </BottomSheet>

      {confirmLeave && (
        <ConfirmModal title={t.leaveSiteTitle} confirmLabel={t.leaveSiteConfirm} cancelLabel={t.cancel}
          onConfirm={() => { window.open(CHANGELOG_WEB_URL, "_blank", "noopener,noreferrer"); setConfirmLeave(false); }} onCancel={() => setConfirmLeave(false)}>{t.leaveSiteBody}</ConfirmModal>
      )}
      {showGithubConfirm && (
        <ConfirmModal title={t.openGitHub} confirmLabel={t.goToGitHub} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { window.open("https://github.com/dsimdev/finmoves-app/blob/main/README.md", "_blank", "noopener,noreferrer"); setShowGithubConfirm(false); }} onCancel={() => setShowGithubConfirm(false)}>{t.goToGitHubBody}</ConfirmModal>
      )}
    </div>
  );
}
