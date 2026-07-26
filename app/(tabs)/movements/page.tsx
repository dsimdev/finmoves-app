"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useData } from "../data-context";
import { agruparPorPeriodo, fechaCorta } from "@/utils/periodo";
import { movMatchesAny } from "@/utils/search";
import { recurrentKey } from "@/utils/recurrent-key";
import { borrables, recategorizables, toggleId } from "@/utils/seleccion";
import { eliminarMovimientos, recategorizarMovimientos, restaurarMovimientos } from "@/services/firebase/movimientos";
import { useAuth } from "@/hooks/useAuth";
import { useLongPress } from "@/hooks/useLongPress";
import { SelectionBar } from "@/components/movements/SelectionBar";
import { CategoriaIcono } from "@/components/ui/CategoriaIcono";
import { visualDeCategoria } from "@/utils/categoria-visual";
import { UndoToast } from "@/components/ui/UndoToast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useMoney } from "@/hooks/useHideValues";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { Movimiento } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { MovementModal } from "@/components/movements/MovementModal";
import { MovementsFilter } from "@/components/movements/MovementsFilter";
import { MovementsTable } from "@/components/desktop/MovementsTable";
import { SearchBar } from "@/components/desktop/SearchBar";
import { QuickAdd } from "@/components/desktop/QuickAdd";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useT } from "@/hooks/useTranslation";
import { useHint } from "@/hooks/useHint";
import { SectionHint } from "@/components/ui/SectionHint";
import { SwipeToDelete } from "@/components/ui/SwipeToDelete";
import { PageHeader } from "@/components/ui/PageHeader";
import { APP_GRAD_DIM, appGradText } from "@/components/ui/gradients";

/**
 * Fila de la lista con long-press. Es un componente aparte porque el hook de long-press
 * necesita estado propio por fila (no se puede llamar dentro de un .map).
 */
function RowButton({ onTap, onLongPress, children, ...rest }: {
  onTap: () => void;
  onLongPress: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}) {
  const { handlers, consumioClick } = useLongPress(onLongPress);
  return (
    <button
      {...rest}
      {...handlers}
      // Tras un long-press el navegador manda igual el click: se ignora para no abrir
      // además el detalle del movimiento que se acaba de seleccionar.
      onClick={() => { if (!consumioClick()) onTap(); }}
    >
      {children}
    </button>
  );
}

export default function MovimientosPage() {
  const { oculto, toggle, m: money } = useMoney();
  const { movimientos, loading, refresh, config, updateMovimiento, removeMovimiento, prependMovimiento, recurrentes, recurrentesLoaded } = useData();
  const { user } = useAuth();
  const t = useT();

  // Ícono/color de cada movimiento: se busca su categoría en la config para leer lo elegido.
  // Si no está (categoría borrada, o Move/RESTO que no son categorías reales), se usa solo el
  // nombre y utils/categoria-visual deduce un default.
  const catsPorNombre = useMemo(() => {
    const m = new Map<string, { nombre: string; icono?: string; color?: string }>();
    for (const c of config?.categorias ?? []) m.set(c.nombre, c);
    return m;
  }, [config?.categorias]);
  const catDe = (mov: Movimiento) => catsPorNombre.get(mov.categoria) ?? { nombre: mov.categoria };

  // Recurrentes activos → para marcar con un relojito los movimientos que matchean.
  // La clave incluye la observación (recurrentKey, la MISMA que usan el doc id y el cron):
  // "Steam·eso+" y "Steam·eso pass" son recurrentes distintos, así que un movimiento solo
  // se marca si coincide TAMBIÉN la observación.
  const recurrenteKeys = useMemo(
    () => new Set(recurrentes.filter((r) => r.activo).map((r) => recurrentKey(r))),
    [recurrentes]
  );
  const esRecurrente = (m: Movimiento) => recurrenteKeys.has(recurrentKey(m));
  const [showHint, dismissHint] = useHint("swipeRow");

  const periodos = agruparPorPeriodo(movimientos);
  const [añoSel, setAñoSel] = useState<string>("");
  const pillSel: React.CSSProperties = { border: "1px solid transparent", background: APP_GRAD_DIM };
  const pillOff: React.CSSProperties = { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)" };
  const pillGradText: React.CSSProperties = appGradText;
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);

  // Filtro in-place (lupa): términos que acotan la lista al período SELECCIONADO. El popup
  // se abre desde la lupa del header y filtra sin navegar a otra pantalla.
  // En pantalla ancha, la lista táctil se reemplaza por una tabla densa y ordenable.
  const isDesktop = useIsDesktop();
  // Error de la carga rápida (la escritura falla después de mostrar la fila optimista).
  // Se auto-cierra: es un aviso, no un estado que haya que despejar a mano.
  const [quickError, setQuickError] = useState<string | null>(null);
  useEffect(() => {
    if (!quickError) return;
    const id = setTimeout(() => setQuickError(null), 5000);
    return () => clearTimeout(id);
  }, [quickError]);
  const [filterOpen, setFilterOpen] = useState(false);
  const lupaRef = useRef<HTMLButtonElement>(null); // ancla del popover del filtro
  const [filterTerms, setFilterTerms] = useState<string[]>([]);
  // Ámbito del filtro: por defecto el período seleccionado; con `todosPeriodos`, todo el
  // historial. En global el selector de año/período se REDUCE a los que tienen coincidencias,
  // así se navega con las mismas pills en vez de una vista aparte.
  const [todosPeriodos, setTodosPeriodos] = useState(false);
  const filterActivo = filterTerms.length > 0;
  const busquedaGlobal = filterActivo && todosPeriodos;

  // Períodos que ofrece el selector: todos, o solo los que matchean si la búsqueda es global.
  const periodosVisibles = useMemo(
    () => (busquedaGlobal ? periodos.filter((p) => p.movimientos.some((m) => movMatchesAny(m, filterTerms))) : periodos),
    [periodos, busquedaGlobal, filterTerms]
  );
  const años = useMemo(
    () => Array.from(new Set(periodosVisibles.map((p) => p.periodoId.split("/")[2] ?? ""))).filter(Boolean),
    [periodosVisibles]
  );
  // El año elegido puede quedar fuera del recorte (buscaste algo que no está en ese año):
  // en ese caso cae al primero con coincidencias, que es el más reciente.
  const añoActivo = añoSel && años.includes(añoSel) ? añoSel : años[0] ?? "";
  const periodosDelAño = useMemo(
    () => periodosVisibles.filter((p) => (p.periodoId.split("/")[2] ?? "") === añoActivo),
    [periodosVisibles, añoActivo]
  );
  // Igual que el año: si el período seleccionado no está entre los que matchean, salta al
  // más reciente con resultados (periodos viene del más nuevo al más viejo).
  const activePeriodoId = periodoSel && periodosDelAño.some((p) => p.periodoId === periodoSel)
    ? periodoSel
    : periodosDelAño[0]?.periodoId;
  const periodoActual = periodos.find((p) => p.periodoId === activePeriodoId);

  // Modal de alta/edición (componente compartido). `view` permite abrir directo en borrado.
  const [modalState, setModalState] = useState<{ mode: "add" | "edit"; mov?: Movimiento; view?: "form" | "delete"; prefill?: { tipo?: "Gasto" | "Ingreso"; categoria?: string; descripcion?: string; observaciones?: string } } | null>(null);
  const openAdd = () => setModalState({ mode: "add" });
  const openEdit = (m: Movimiento) => setModalState({ mode: "edit", mov: m });

  // ── Selección múltiple ──────────────────────────────────────────────────────
  // Se entra con long-press sobre una fila (móvil) o el checkbox de la tabla (escritorio).
  // Las reglas de qué se puede borrar/recategorizar viven en utils/seleccion (testeadas).
  const [seleccion, setSeleccion] = useState<string[] | null>(null); // null = modo apagado
  const modoSeleccion = seleccion !== null;
  // Alternar un ítem. Si al sacarlo la selección queda vacía, se SALE del modo (vuelve a null):
  // quedarse en "0 seleccionados" no tiene sentido — deseleccionar todo = salir.
  const alternar = (id: string) => setSeleccion((prev) => {
    const next = toggleId(prev ?? [], id);
    return next.length === 0 ? null : next;
  });
  const salirSeleccion = () => setSeleccion(null);
  // Borrado en lote pendiente de confirmar: mientras el toast está arriba se puede deshacer.
  const [borradoUndo, setBorradoUndo] = useState<Movimiento[] | null>(null);

  const aBorrar = useMemo(
    () => (seleccion ? borrables(seleccion, movimientos) : []),
    [seleccion, movimientos]
  );
  const aRecategorizar = useMemo(
    () => (seleccion ? recategorizables(seleccion, movimientos) : []),
    [seleccion, movimientos]
  );

  // Borrar en lote pide confirmar ANTES (es destructivo y son varios), y ofrece deshacer
  // DESPUÉS. La barra dispara la confirmación; recién al confirmar se ejecuta el borrado.
  const [confirmarBorradoLote, setConfirmarBorradoLote] = useState(false);
  const borrarSeleccion = async () => {
    if (!user?.uid || aBorrar.length === 0) return;
    // El pulso lo dispara el botón del ConfirmModal que llama acá.
    const borrados = aBorrar;
    setConfirmarBorradoLote(false);
    // Optimista: desaparecen ya y el toast ofrece deshacer mientras tanto.
    borrados.forEach((m) => removeMovimiento(m.id));
    setSeleccion(null);
    setBorradoUndo(borrados);
    try {
      await eliminarMovimientos(user.uid, borrados.map((m) => m.id));
    } catch {
      borrados.forEach((m) => prependMovimiento([m])); // volvió a fallar: restaurar en pantalla
      setBorradoUndo(null);
    }
  };

  const deshacerBorrado = async () => {
    if (!user?.uid || !borradoUndo) return;
    const movs = borradoUndo;
    setBorradoUndo(null);
    prependMovimiento(movs); // vuelven a la lista al toque
    await restaurarMovimientos(user.uid, movs).catch(() => refresh());
  };

  const recategorizarSeleccion = async (categoria: string) => {
    if (!user?.uid || aRecategorizar.length === 0) return;
    const ids = aRecategorizar.map((m) => m.id);
    ids.forEach((id) => updateMovimiento(id, { categoria })); // optimista
    setSeleccion(null);
    await recategorizarMovimientos(user.uid, ids, categoria).catch(() => refresh());
  };

  // Realce breve del movimiento recién cargado (feedback visual del guardado).
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const handleCreated = (movs: Movimiento[]) => {
    prependMovimiento(movs);
    setFlashIds(new Set(movs.map((m) => m.id)));
    setTimeout(() => setFlashIds(new Set()), 1400);
  };

  // Deep-link a la carga: atajo del launcher (?nuevo=1), acción "Cargar" del push, o
  // ?recurrente=<id> (desde el panel de notificaciones) → alta pre-cargada con ese
  // recurrente (monto vacío). Espera a que `recurrentes` esté cargado para poder resolverlo.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const recId = sp.get("recurrente");
    if (recId) {
      const r = recurrentes.find((x) => x.id === recId);
      if (r) {
        setModalState({ mode: "add", prefill: { tipo: r.tipo, categoria: r.categoria, descripcion: r.descripcion, observaciones: r.observaciones } });
        window.history.replaceState(window.history.state, "", "/movements");
      } else if (recurrentesLoaded) {
        // Template borrado (notificación vieja) → alta en blanco y URL limpia igual.
        openAdd();
        window.history.replaceState(window.history.state, "", "/movements");
      }
      return;
    }
    if (sp.get("nuevo") === "1") {
      openAdd();
      window.history.replaceState(window.history.state, "", "/movements");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrentes, recurrentesLoaded]);

  // Si llegamos con ?m=<id> (desde el dashboard), abrir ese movimiento para editar.
  useEffect(() => {
    if (loading || movimientos.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("m");
    if (!id) return;
    const mov = movimientos.find((x) => x.id === id);
    if (mov) openEdit(mov);
    window.history.replaceState(window.history.state, "", "/movements");
  }, [loading, movimientos]);

  // Fade del botón flotante: se oculta mientras se navega (scroll) y reaparece
  // al detenerse, para no tapar la lista mientras la recorrés.
  const btnVisible = useHideOnScroll();

  const movsFiltrados = useMemo(() =>
    [...(periodoActual?.movimientos ?? [])]
      .filter((m) => m.tipo !== "GastoUSD" && m.tipo !== "GastoEUR" && m.tipo !== "IngresoUSD" && m.tipo !== "IngresoEUR")
      // Filtro de la lupa: si hay términos, acotar a los que matchean (OR, palabra exacta).
      .filter((m) => !filterActivo || movMatchesAny(m, filterTerms))
      .sort((a, b) => {
        const d = b.fecha.localeCompare(a.fecha);
        if (d !== 0) return d;
        const tt = b.timestampCarga.getTime() - a.timestampCarga.getTime();
        if (tt !== 0) return tt;
        // Mismo instante (apertura de período): el Sueldo es el ancla → siempre el más
        // viejo (abajo de todo), determinístico entre dispositivos.
        const aSueldo = a.tipo === "Ingreso" && a.categoria === "Sueldo";
        const bSueldo = b.tipo === "Ingreso" && b.categoria === "Sueldo";
        if (aSueldo && !bSueldo) return 1;
        if (bSueldo && !aSueldo) return -1;
        return 0;
      }),
    [periodoActual, filterActivo, filterTerms]
  );

  // Resumen del filtro (total, cantidad, promedio) sobre lo matcheado en el período.
  const filterResumen = useMemo(() => {
    if (!filterActivo) return null;
    const total = movsFiltrados.reduce((s, m) => s + m.monto, 0);
    const count = movsFiltrados.length;
    return { total, count, avg: count > 0 ? total / count : 0 };
  }, [filterActivo, movsFiltrados]);

  const movsPorFecha = useMemo(() => {
    const groups: { fecha: string; movs: typeof movsFiltrados }[] = [];
    for (const m of movsFiltrados) {
      if (groups.length === 0 || groups[groups.length - 1].fecha !== m.fecha)
        groups.push({ fecha: m.fecha, movs: [] });
      groups[groups.length - 1].movs.push(m);
    }
    return groups;
  }, [movsFiltrados]);

  // Días colapsables: para evitar el scroll infinito, solo el día más reciente
  // arranca abierto; el resto se muestra como resumen (total + nº) y se abren al tocar.
  const [diasAbiertos, setDiasAbiertos] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Con filtro activo, abrir TODOS los días (querés ver el resultado completo, no colapsado).
    // Sin filtro, solo el día más reciente (evita el scroll infinito).
    if (filterActivo) setDiasAbiertos(new Set(movsPorFecha.map((g) => g.fecha)));
    else setDiasAbiertos(new Set(movsPorFecha[0] ? [movsPorFecha[0].fecha] : []));
    // Al cambiar de período/año, al (des)activar el filtro o al cambiar su ámbito. No al
    // editar (no cerrar lo abierto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriodoId, filterActivo, busquedaGlobal]);
  const toggleDia = (fecha: string) => setDiasAbiertos((prev) => {
    const next = new Set(prev);
    next.has(fecha) ? next.delete(fecha) : next.add(fecha);
    return next;
  });

  return (
    <>
    {/* La tabla de escritorio usa todo el ancho (más columnas legibles); la lista táctil
        del móvil se queda en su columna cómoda. */}
    <div className={`page ${isDesktop ? "page-fluid" : "page-mid"}`}>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="fade-up">
          {/* En modo selección la barra de acciones ocupa el lugar del header, como en
              cualquier bandeja: el contexto pasa a ser "qué hago con lo elegido". */}
          {modoSeleccion && (
            <SelectionBar
              count={seleccion!.length}
              nBorrables={aBorrar.length}
              nRecategorizables={aRecategorizar.length}
              categorias={(config?.categorias ?? []).filter((c) => c.activa)}
              onCancel={salirSeleccion}
              onDelete={() => setConfirmarBorradoLote(true)}
              onRecategorize={recategorizarSeleccion}
            />
          )}
          <div style={{ marginBottom: 20, display: modoSeleccion ? "none" : undefined }}>
            <PageHeader
              title={t.pageTitleMovements}
              style={{ marginBottom: 0 }}
              right={
                /* La lupa abre el popover del filtro. En escritorio no va: el buscador es
                   una barra siempre visible sobre la tabla (SearchBar). */
                isDesktop ? null : (
                <button ref={lupaRef} onClick={() => setFilterOpen(true)} aria-label={t.filterTitle} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: filterActivo ? "var(--accent)" : "var(--muted)", padding: 6, margin: -6, display: "flex" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  {filterActivo && <span style={{ position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "var(--accent)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{filterTerms.length}</span>}
                </button>
                )
              }
            />
            {periodoActual && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {activePeriodoId === periodos[0]?.periodoId ? t.available : t.remaining}: <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{money(periodoActual.disponible)}</span>
                <button onClick={toggle} aria-label={t.hideValues} style={{
                  background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  padding: 8, margin: -8, // hit-area ~32px sin correr el layout
                }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
            )}
          </div>

          {showHint && movimientos.length > 0 && <SectionHint title={t.hintMovTitle} body={t.hintMovBody} onDismiss={dismissHint} />}

          <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none", touchAction: "pan-x" }}>
            {años.map((año) => {
              const sel = añoActivo === año;
              return (
              <button key={año} onClick={() => { setAñoSel(año); setPeriodoSel(null); }} style={{
                flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                transition: "all 0.15s", ...(sel ? pillSel : pillOff),
              }}>{sel ? <span style={pillGradText}>{año}</span> : año}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none", touchAction: "pan-x" }}>
            {periodosDelAño.map((p) => {
              const isSelected = activePeriodoId === p.periodoId;
              const [d, m] = p.periodoId.split("/");
              // En búsqueda global, cada pill muestra cuántas coincidencias tiene ese período:
              // el selector pasa a ser el mapa de dónde está lo que buscás.
              const n = busquedaGlobal ? p.movimientos.filter((mv) => movMatchesAny(mv, filterTerms)).length : 0;
              return (
                <button key={p.periodoId} onClick={() => setPeriodoSel(p.periodoId)} style={{
                  flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5, ...(isSelected ? pillSel : pillOff),
                }}>
                  {isSelected ? <span style={pillGradText}>{d}/{m}</span> : `${d}/${m}`}
                  {n > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: isSelected ? "var(--accent)" : "var(--muted)", opacity: isSelected ? 1 : 0.8 }}>{n}</span>}
                </button>
              );
            })}
          </div>

          {/* Resumen del filtro (lupa): total / cantidad / promedio de lo matcheado en el período. */}
          {filterResumen && (
            <div className="soft" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 10, border: "1px solid var(--accent)44" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {filterTerms.map((term) => (
                    <span key={term} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 999, padding: "2px 10px" }}>{term}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
                  {t.filterCount(filterResumen.count)} · {t.filterAvg(money(filterResumen.avg))}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{money(filterResumen.total)}</div>
                <button onClick={() => setFilterTerms([])} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "2px 0 0", textDecoration: "underline" }}>{t.filterClear}</button>
              </div>
            </div>
          )}

          {/* Escritorio: buscador siempre visible sobre la tabla (en móvil es el popover
              de la lupa, que acá taparía justo las filas que estás mirando) + carga rápida
              con teclado. El modal completo sigue disponible en "Nuevo movimiento". */}
          {isDesktop && (
            <>
              <SearchBar
                movs={periodoActual?.movimientos ?? []}
                movsGlobal={movimientos}
                terms={filterTerms}
                onChange={setFilterTerms}
                onNew={openAdd}
                todosPeriodos={todosPeriodos}
                onTodosPeriodosChange={setTodosPeriodos}
                seleccionActiva={modoSeleccion}
                onToggleSeleccion={() => setSeleccion((prev) => (prev === null ? [] : null))}
              />
              <QuickAdd
                config={config}
                periodoId={activePeriodoId ?? null}
                onCreated={handleCreated}
                onRollback={removeMovimiento}
                onError={setQuickError}
              />
              {quickError && (
                <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: "9px 13px", marginBottom: 12, fontSize: 12, color: "var(--red)" }}>
                  {quickError}
                </div>
              )}
            </>
          )}

          {movsFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
              {!filterActivo ? t.noMovementsAdd : busquedaGlobal ? t.filterNoResultsGlobal : t.filterNoResults}
            </div>
          ) : isDesktop ? (
            /* Escritorio: tabla densa y ordenable en vez de la lista táctil agrupada por día.
               Misma data y mismo orden canónico (utils/movement-sort); cambia la presentación. */
            <MovementsTable
              movimientos={movsFiltrados}
              onEdit={(m) => setModalState({ mode: "edit", mov: m, view: "form" })}
              onDelete={(m) => setModalState({ mode: "edit", mov: m, view: "delete" })}
              seleccion={seleccion}
              onToggleSel={alternar}
              onToggleTodos={(ids, marcar) => setSeleccion(marcar ? ids : [])}
              catDe={catDe}
            />
          ) : (

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {movsPorFecha.map(({ fecha, movs }, idx) => {
                // El día más reciente siempre abierto; el resto colapsa a un resumen (fecha + total).
                const abierto = idx === 0 ? true : diasAbiertos.has(fecha);
                // Conteo por tipo (lo sigue usando el total del día abierto con filtro).
                let nGasto = 0, nMoveAhorro = 0, nMoveDisp = 0, nUsd = 0, nIngreso = 0;
                // Día CERRADO: lo que importa es cuánto se gastó, no cuántos movimientos hubo
                // ("3" no dice nada, "$45.000" sí). El gastado usa el MISMO criterio que
                // utils/periodo (Gasto + CompraUSD), para que el total del día coincida con lo
                // que muestra Reportes. Lo que queda fuera de esa cuenta (ingreso, moves, resto
                // de operaciones de divisa) no se numera: va como un dot de su color al lado,
                // que dice "además pasó esto" sin sumar texto ni competir con el monto.
                let gastadoDia = 0;
                for (const m of movs) {
                  if (m.tipo === "Gasto") { nGasto++; gastadoDia += m.monto; }
                  else if (m.tipo === "Move") {
                    if (m.direccionMove === "aAhorro") nMoveAhorro++;
                    else nMoveDisp++;
                  }
                  else if (m.tipo === "Ingreso") nIngreso++;
                  else {
                    nUsd++;
                    if (m.tipo === "CompraUSD") gastadoDia += m.monto;
                  }
                }
                // Dots de lo que quedó FUERA del gastado, en el orden del resto de la app. Las
                // operaciones de divisa solo ponen dot si alguna no entró ya en el total
                // (CompraUSD sí entra: sería contarla dos veces).
                const fxFueraDelTotal = movs.some((m) =>
                  m.tipo !== "Gasto" && m.tipo !== "Ingreso" && m.tipo !== "Move" && m.tipo !== "CompraUSD");
                const dots = [
                  nIngreso > 0 && "var(--green)",
                  fxFueraDelTotal && "var(--yellow)",
                  nMoveDisp > 0 && "var(--teal)",
                  nMoveAhorro > 0 && "var(--purple)",
                ].filter(Boolean) as string[];
                return (
                <div key={fecha} className="card" style={{ padding: 0, overflow: "hidden", background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <button onClick={() => { if (idx !== 0) toggleDia(fecha); }} style={{
                    width: "100%", background: "none", cursor: idx === 0 ? "default" : "pointer",
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                    border: "none", borderBottom: abierto ? "1px solid var(--faint)" : "none",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.3 }}>{fechaCorta(fecha)}</span>
                    {!abierto && (
                      <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 7 }}>
                        {/* Los dots primero: el monto queda pegado al borde, que es donde se
                            alinea con el resto de los números de la lista. */}
                        {dots.length > 0 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            {dots.map((c) => (
                              <span key={c} style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
                            ))}
                          </span>
                        )}
                        {/* Un día sin gasto (solo ingreso o moves) muestra "—": un $0 se lee
                            como dato y esto se lee como "acá no hubo gasto". */}
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: gastadoDia > 0 ? "var(--red)" : "var(--muted)" }}>
                          {gastadoDia > 0 ? money(gastadoDia) : "—"}
                        </span>
                      </span>
                    )}
                    {/* Con filtro activo y el día abierto: total de lo filtrado ese día a la
                        derecha, con el color del tipo (rojo gasto, verde ingreso, etc.). Si el
                        día mezcla tipos, queda neutro (accent). */}
                    {filterActivo && abierto && (() => {
                      // Color por tipo homogéneo (los conteos ya están calculados arriba).
                      const tipos = [nGasto > 0, nIngreso > 0, nMoveAhorro > 0, nMoveDisp > 0, nUsd > 0].filter(Boolean).length;
                      const color = tipos !== 1 ? "var(--accent)"
                        : nGasto > 0 ? "var(--red)"
                        : nIngreso > 0 ? "var(--green)"
                        : nMoveAhorro > 0 ? "var(--purple)"
                        : nMoveDisp > 0 ? "var(--teal)"
                        : "var(--yellow)"; // usd/fx
                      return (
                        <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>
                          {money(movs.reduce((s, m) => s + m.monto, 0))}
                        </span>
                      );
                    })()}
                  </button>
                  {abierto && (
                  <>
                    {movs.map((m, i) => {
                      const isCompraFX = m.tipo === "CompraUSD" || m.tipo === "CompraEUR";
                      const isVentaFX = m.tipo === "VentaUSD" || m.tipo === "VentaEUR";
                      const isFX = isCompraFX || isVentaFX; // divisa → color amarillo
                      const isGasto = m.tipo === "Gasto";
                      const isMove = m.tipo === "Move";
                      const esResto = m.categoria === "RESTO"; // arrastre a ahorros: azul y "+"
                      const negativo = !esResto && (isGasto || isCompraFX || (isMove && m.direccionMove === "aAhorro"));
                      // Color del TIPO del movimiento: lo usan el monto y el resaltado del swipe.
                      const colorTipo = esResto ? "var(--blue)" : isFX ? "var(--yellow)" : isGasto ? "var(--red)" : isMove ? (m.direccionMove === "aAhorro" ? "var(--purple)" : "var(--teal)") : "var(--green)";
                      // El resaltado del swipe usa el color de la CATEGORÍA (el que el usuario
                      // configuró), para que sienta que "es su app". El monto sigue con el color
                      // del tipo. Move/RESTO/FX (visual fija) caen en su color semántico.
                      const colorCat = visualDeCategoria(catDe(m)).hex;
                      return (
                        <SwipeToDelete key={m.id} deleteLabel={t.delete} editLabel={t.edit} railBg="var(--surface-alt)" accent={colorCat}
                          disabled={modoSeleccion}
                          onEdit={() => setModalState({ mode: "edit", mov: m, view: "form" })}
                          onDelete={() => setModalState({ mode: "edit", mov: m, view: "delete" })}>
                        {(abierta) => (
                        <RowButton
                          className={flashIds.has(m.id) ? "row-tap flash-row" : "row-tap"}
                          // Con la selección activa el tap alterna; si no, abre el detalle.
                          // El long-press entra en selección con esta fila ya marcada.
                          onTap={() => (modoSeleccion ? alternar(m.id) : openEdit(m))}
                          onLongPress={() => setSeleccion((prev) => (prev && prev.includes(m.id) ? prev : [...(prev ?? []), m.id]))}
                          aria-label={t.edit} style={{
                          width: "100%", textAlign: "left", cursor: "pointer",
                          display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 14px",
                          border: "none", borderBottom: i < movs.length - 1 ? "1px solid var(--faint)" : "none",
                          WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none",
                          // Fondo del seleccionado: el mismo acento que el resto de la app.
                          background: seleccion?.includes(m.id) ? "var(--accent-dim)" : "none",
                        }}>
                          {/* Ícono de la CATEGORÍA. Reemplazó al punto de color por tipo: el
                              tipo ya se lee en el color del monto, así que el punto repetía
                              información y gastaba el lugar donde ahora entra la categoría. */}
                          <CategoriaIcono categoria={catDe(m)} size={34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.categoria}</span>
                              {esRecurrente(m) && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-label={t.recurrentsTitle}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                              )}
                            </div>
                            {/* La categoría ya la dice el ícono, así que el subtítulo queda para
                                la observación. Solo se nombra cuando el movimiento no tiene
                                descripción (ahí el título ES la categoría y no hay qué repetir).
                                Al swipear se oculta la observación para que el texto no se corte
                                contra el tacho. */}
                            {m.observaciones && !abierta && (
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: "italic" }}>
                                {m.observaciones.toLowerCase()}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: colorTipo, fontFamily: "var(--font-mono)", flexShrink: 0, marginTop: 1, paddingRight: 4 }}>
                            {negativo ? "-" : "+"}{money(m.monto)}
                          </span>
                        </RowButton>
                        )}
                        </SwipeToDelete>
                      );
                    })}
                  </>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>

    {/* Botón flotante — fijo sobre el navbar, se oculta tras inactividad. Es un patrón
        táctil (al alcance del pulgar): en escritorio lo reemplaza el botón con texto que
        vive en la barra del buscador. */}
    {!loading && !isDesktop && <button
      onClick={() => openAdd()}
      aria-label={t.newMovement}
      style={{
        position: "fixed",
        bottom: "calc(var(--nav-h) + 8px)",
        left: 0, right: 0, margin: "0 auto",
        width: 54, height: 54,
        borderRadius: "50%",
        background: "transparent",
        color: "var(--green)",
        border: "none",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
        filter: "drop-shadow(0 2px 12px var(--green)99)",
        opacity: btnVisible ? 1 : 0,
        pointerEvents: btnVisible ? "all" : "none",
        transition: "opacity 0.4s ease",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>}

    <MovementModal
      open={modalState !== null}
      mode={modalState?.mode ?? "add"}
      movimiento={modalState?.mov ?? null}
      movimientos={movimientos}
      config={config}
      activePeriodoId={activePeriodoId}
      initialView={modalState?.view}
      prefill={modalState?.prefill ?? null}
      onClose={() => setModalState(null)}
      onChanged={refresh}
      onCreated={handleCreated}
      onUpdated={updateMovimiento}
      onDeleted={removeMovimiento}
    />
    {/* Confirmación ANTES del borrado en lote (destructivo, varios ítems). Al confirmar, el
        borrado optimista + el deshacer del toast de abajo. */}
    {confirmarBorradoLote && (
      <ConfirmModal
        title={t.delete}
        confirmLabel={t.yesDelete}
        cancelLabel={t.cancel}
        confirmColor="var(--red)"
        onConfirm={borrarSeleccion}
        onCancel={() => setConfirmarBorradoLote(false)}
      >
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          {t.deleteSelectedConfirm(aBorrar.length)}
        </div>
      </ConfirmModal>
    )}

    {/* Deshacer del borrado en lote: la escritura ya salió, pero se puede revertir mientras
        el aviso siga arriba (restaura los docs con su mismo id). */}
    {borradoUndo && (
      <UndoToast
        mensaje={t.deletedCount(borradoUndo.length)}
        accion={t.undo}
        onUndo={deshacerBorrado}
        onDismiss={() => setBorradoUndo(null)}
      />
    )}

    <MovementsFilter
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      movs={periodoActual?.movimientos ?? []}
      movsGlobal={movimientos}
      terms={filterTerms}
      onChange={setFilterTerms}
      todosPeriodos={todosPeriodos}
      onTodosPeriodosChange={setTodosPeriodos}
      anchorRef={lupaRef}
    />
    </>
  );
}
