"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../data-context";
import { useT } from "@/hooks/useTranslation";
import { auth } from "@/services/firebase/firebase";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NavRow } from "./_shared";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsLanding() {
  const { user } = useAuth();
  const { config, configLoading: loading } = useData();
  const t = useT();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  // Guarda la URL que falló, no un booleano: así "hay error" se deriva comparando contra la
  // URL actual en cada render, sin necesitar un efecto que resetee el flag cuando cambia la
  // foto (React desaconseja setState síncrono en efecto para esto; comparar valores alcanza).
  const [fotoErrorUrl, setFotoErrorUrl] = useState<string | null>(null);

  // En escritorio el menú lo reemplaza la columna de secciones del layout: esta pantalla
  // quedaría vacía, así que se entra directo a la primera sección.
  useEffect(() => {
    if (isDesktop) router.replace("/settings/account");
  }, [isDesktop, router]);

  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;

  if (loading || !config) return <div className="page page-narrow"><LoadingSpinner /></div>;

  const googlePhoto = auth.currentUser?.providerData.find((p) => p.providerId === "google.com")?.photoURL;
  const fotoSrc = config.meta.fotoURL || googlePhoto || null;
  const tieneNombre = !!config.meta.nombre;

  const i = (children: React.ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

  return (
    <div className="page page-fluid fade-up">
      <PageHeader title={t.pageTitleSettings} />

      {/* En escritorio el menú pasa a grilla de 2 columnas (ver .settings-menu): una fila
          por sección a todo el ancho deja el ícono perdido y la línea larguísima. */}
      <div className="settings-menu">

      {/* Header de perfil → edita perfil */}
      <Link href="/settings/account" className="settings-profile" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        {fotoSrc && fotoSrc !== fotoErrorUrl ? (
          <img src={fotoSrc} alt="" width={52} height={52} referrerPolicy="no-referrer" onError={() => setFotoErrorUrl(fotoSrc)} style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover", flexShrink: 0, border: "1px solid var(--green)44" }} />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: 14, background: tieneNombre ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${tieneNombre ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={tieneNombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" /><path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke={tieneNombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" strokeLinecap="round" /></svg>
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{config.meta.nombre || t.user}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
      </Link>

      <NavRow href="/settings/preferences" color="var(--muted)" title={t.preferences} sub={t.darkMode}
        icon={i(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>)} />

      <NavRow href="/settings/notifications" color="var(--muted)" title={t.notifications} sub={t.notificationsSub}
        icon={i(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>)} />

      <NavRow href="/settings/movements" color="var(--muted)" title={t.settingsTabMovements} sub={`${t.categories} · ${t.settingsTabBudgets}`}
        icon={i(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>)} />

      {inversionAllowed && (
        <NavRow href="/settings/investment" color="var(--muted)" title={t.settingsTabInvestments} sub={t.investmentCurrency}
          icon={i(<><polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/></>)} />
      )}

      <NavRow href="/settings/help" color="var(--muted)" title={t.guideSection} sub={`v${process.env.NEXT_PUBLIC_APP_VERSION}`}
        icon={i(<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>)} />
      </div>
    </div>
  );
}
