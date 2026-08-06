"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import { crearMovimientoConId, nuevoMovimientoId, actualizarMovimiento } from "@/services/firebase/movimientos";
import { upsertRecurrente } from "@/services/firebase/recurrentes";
import { recurrentKey } from "@/utils/recurrent-key";
import { sugerirRecurrente } from "@/utils/recurrent-detection";
import { crearPlantilla, eliminarPlantilla, usarPlantilla, type Plantilla } from "@/services/firebase/plantillas";
import { useData } from "@/app/(tabs)/data-context";
import { uploadComprobante } from "@/lib/storage";
import { useAddForm } from "./useAddForm";
import { ComprobanteField } from "./movement-shared";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet as Sheet } from "@/components/ui/BottomSheet";
import { agruparPorPeriodo, formatARS, fechaAPeriodoId } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { reservaFX } from "@/utils/reserva";
import { fxFlags, calcularFX, num } from "@/utils/movement-fx";
import { pctPresupuestoCategoria } from "@/utils/budget-alert";
import { colorPct, colorPctDim } from "@/components/reports/format";
import { obtenerPresupuesto } from "@/services/firebase/presupuestos";
import { Movimiento, TipoMovimiento, ConfigUsuario } from "@/types";
import { feedback } from "@/lib/feedback";

export interface MovementAddProps {
  open: boolean;
  /** Movimientos del usuario (para derivar períodos/categorías/plantillas usadas). */
  movimientos: Movimiento[];
  config: ConfigUsuario | null;
  /** Período al que se carga el alta. Por defecto, el más reciente. */
  activePeriodoId?: string;
  /** Alta pre-cargada (desde un recurrente): completa tipo/categoría/descripción/observación; el monto queda vacío. */
  prefill?: { tipo?: "Gasto" | "Ingreso"; categoria?: string; descripcion?: string; observaciones?: string } | null;
  /** Modo reserva (abierto desde Inversión): solo carga +Reserva / -Reserva (FX). */
  reserveMode?: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** Alta optimista: recibe los movimientos creados con su ID definitivo. */
  onCreated?: (movs: Movimiento[]) => void;
  /** Actualización optimista al parchear la URL del comprobante subido en background. */
  onUpdated?: (id: string, patch: Partial<Movimiento>) => void;
  onDeleted?: (id: string) => void;
}

// Alta de movimientos (Gasto/Ingreso/Move/reserva FX), como BottomSheet: mucho contenido
// (tipo, plantillas, categorías, FX, apertura de período, recurrente). Alta optimista: se
// muestra y cierra YA; persiste en background (rollback si falla).
export function MovementAdd({ open, movimientos, config, activePeriodoId, prefill, reserveMode, onClose, onChanged, onCreated, onUpdated, onDeleted }: MovementAddProps) {
  const { user } = useAuth();
  const { plantillas, mutatePlantillas, refreshPlantillas, refreshRecurrentes, recurrentes } = useData();
  const { cotizacion } = useCotizacion();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const { m: money } = useMoney();
  const t = useT();

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" : monedaPrincipal === "EUR" ? "USD" : monedaInversiones;
  const esEURMode = monedaInversionesEfectiva === "EUR";

  // En modo reserva (desde Inversión) solo se cargan +Reserva / -Reserva (FX).
  // En modo normal, las cargas a la reserva ya no se ofrecen acá.
  const TIPOS: { t: TipoMovimiento; label: string; color: string }[] = reserveMode ? [
    { t: (esEURMode ? "CompraEUR" : "CompraUSD") as TipoMovimiento, label: t.buy, color: "var(--green)" },
    { t: (esEURMode ? "IngresoEUR" : "IngresoUSD") as TipoMovimiento, label: t.fxIncome, color: "var(--green)" },
    { t: (esEURMode ? "VentaEUR" : "VentaUSD") as TipoMovimiento, label: t.sell, color: "var(--red)" },
    { t: (esEURMode ? "GastoEUR" : "GastoUSD") as TipoMovimiento, label: t.spend, color: "var(--red)" },
  ] : [
    { t: "Gasto", label: t.tipoDisplay["Gasto"], color: "var(--red)" },
    { t: "Ingreso", label: t.tipoDisplay["Ingreso"], color: "var(--green)" },
    { t: "Move", label: t.tipoDisplay["Move"], color: "var(--purple)" },
  ];

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const activeId = activePeriodoId ?? periodos[0]?.periodoId;
  const periodoActual = periodos.find((p) => p.periodoId === activeId);
  const serie = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const ahorrosAcumActivo = serie.find((s) => s.periodoId === activeId)?.ahorrosAcum ?? 0;
  const sinPeriodos = periodos.length === 0;

  // Presupuesto efectivo del período (override puntual en users/{uid}/presupuestos/{periodoId},
  // o el template general si no hay override) — mismo criterio que Reportes y el cron de
  // desvío. Se trae al abrir el Sheet, 1 lectura chica (doc único, no colección).
  const [presupuestoOverride, setPresupuestoOverride] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con las props `open`/`activeId` (repoblar al abrir/cambiar de período), no deriva de otro estado calculable en render
    if (!open || !user?.uid || !activeId) { setPresupuestoOverride(null); return; }
    obtenerPresupuesto(user.uid, activeId).then(setPresupuestoOverride).catch(() => setPresupuestoOverride(null));
  }, [open, user?.uid, activeId]);
  const presupuestoEfectivo = presupuestoOverride ?? config?.meta.presupuestoTemplate ?? null;

  // Gastado por categoría del período en curso (Gasto y CompraUSD cuentan, igual que en
  // Reportes y el cron de desvío — ver lib/notifications.ts checkPresupuesto).
  const gastadoPorCategoria = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mv of periodoActual?.movimientos ?? []) {
      if (mv.tipo === "Gasto" || mv.tipo === "CompraUSD") m[mv.categoria] = (m[mv.categoria] ?? 0) + mv.monto;
    }
    return m;
  }, [periodoActual]);

  // ── Add state (hook dedicado: 15 campos + reset) ──
  const {
    form, set: setAddFields, reset: resetAddFields,
    setTipo, setCategoria, setDescripcion, setMonto, setFecha, setMedioPago, setObservaciones,
    setOrigenAhorro, setCantidadUSD, setMontoARSInput, setModoCarga, setCotizManual,
    setAbreNuevoPeriodo, setRepetir, setMoveDir,
  } = useAddForm();
  const {
    tipo, categoria, descripcion, monto, fecha, medioPago, observaciones, origenAhorro,
    cantidadUSD, montoARSInput, modoCarga, cotizManual, abreNuevoPeriodo, repetir, moveDir,
  } = form;

  // ¿La combinación tipo+categoría+descripción+observación ya es un recurrente activo?
  // Delega en recurrentKey (util compartido): MISMA clave que el doc id, el relojito y el
  // cron → incluye observación ("eso+" ≠ "eso pass") y no diverge en bordes (obs vacía, etc.).
  const recKey = (tp: string, c: string, d?: string, o?: string) =>
    recurrentKey({ tipo: tp, categoria: c, descripcion: d, observaciones: o });
  const recurrenteKeys = useMemo(
    () => new Set(recurrentes.filter((r) => r.activo).map((r) => recKey(r.tipo, r.categoria, r.descripcion, r.observaciones))),
    [recurrentes]
  );
  // Si lo que se está cargando ya es un recurrente activo, marcar "repetir" solo (el usuario
  // no lo tiene que re-tildar cada mes). Solo enciende; no lo apaga si el usuario lo desmarcó
  // a propósito para un caso puntual.
  const yaEsRecurrente = ((tipo === "Gasto" || tipo === "Ingreso") && descripcion.trim())
    ? recurrenteKeys.has(recKey(tipo, categoria, descripcion, observaciones))
    : false;
  useEffect(() => {
    if (yaEsRecurrente) setRepetir(true);
  }, [yaEsRecurrente, setRepetir]);
  // Sugerencia pasiva: la misma combinación apareció en 3+ períodos distintos sin estar
  // marcada como recurrente todavía. Todo en memoria (movimientos ya vienen por props), sin
  // query nueva. No se muestra si ya es recurrente (yaEsRecurrente cubre ese caso arriba).
  const sugerenciaRecurrente = ((tipo === "Gasto" || tipo === "Ingreso") && descripcion.trim() && !yaEsRecurrente)
    ? sugerirRecurrente(movimientos, { tipo, categoria, descripcion, observaciones }, recurrenteKeys)
    : false;
  // Alta pre-cargada desde una notificación de recurrente: si ya hay una carga que matchea
  // en los últimos ~28 días, la notificación es vieja (este ciclo ya se cargó) → banner de
  // aviso para no meter un duplicado sin querer.
  const prefillYaCargadoDias = useMemo(() => {
    if (!prefill?.descripcion) return null;
    const key = recKey(prefill.tipo ?? "", prefill.categoria ?? "", prefill.descripcion, prefill.observaciones);
    let ultima = "";
    for (const m of movimientos) {
      if (!m.fecha || recKey(m.tipo, m.categoria, m.descripcion, m.observaciones) !== key) continue;
      if (m.fecha > ultima) ultima = m.fecha;
    }
    if (!ultima) return null;
    const [y, mo, d] = ultima.split("-").map(Number);
    const dias = Math.floor((Date.now() - Date.UTC(y, mo - 1, d)) / 86_400_000);
    return dias >= 0 && dias < 28 ? dias : null;
  }, [prefill, movimientos]);

  // Comprobante: instancia propia de ComprobanteField (ciclo de vida independiente del de
  // Edición). `comprobante` guarda file/removed para el submit; resetKey fuerza el reset
  // cada vez que el sheet se reabre.
  const [comprobante, setComprobante] = useState<{ file: File | null; removed: boolean }>({ file: null, removed: false });
  const [addResetKey, setAddResetKey] = useState(0);

  // Errores de la persistencia en background (el alta es optimista: el sheet ya se cerró).
  // `bgError` = aviso transitorio (auto-cierra). `pendingReceipt` = comprobante que no se
  // pudo subir; toast FIJO con "Reintentar" que retiene el File (no se pierde la foto).
  const [bgError, setBgError] = useState<string | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState<{ movId: string; file: File } | null>(null);
  useEffect(() => {
    if (!bgError || pendingReceipt) return;
    const id = setTimeout(() => setBgError(null), 4500);
    return () => clearTimeout(id);
  }, [bgError, pendingReceipt]);

  // Sube el comprobante y parchea la URL en el movimiento ya visible. El reintento ante el
  // cold start de Cloud Run vive en uploadComprobante; si aun así falla, deja el File
  // pendiente para que el usuario reintente sin volver a elegirlo.
  const subirComprobante = async (movId: string, file: File) => {
    if (!user?.uid) return;
    setPendingReceipt(null);
    try {
      const up = await uploadComprobante(user.uid, file);
      await actualizarMovimiento(user.uid, movId, { comprobanteUrl: up.url, comprobantePath: up.path });
      onUpdated?.(movId, { comprobanteUrl: up.url, comprobantePath: up.path });
    } catch (err) {
      console.error("[comprobante] no se pudo subir", err); setPendingReceipt({ movId, file });
    }
  };
  const [addError, setAddError] = useState("");

  // Plantillas de gasto frecuente (del DataProvider, se leen 1×/sesión).
  const [tplDelete, setTplDelete] = useState<Plantilla | null>(null);
  const [tplSavedFlash, setTplSavedFlash] = useState(false);

  // Limpia el form conservando tipo y medio de pago (ver estadoReseteado). Los botones de
  // tipo hacen setTipo(x) y DESPUÉS resetAdd(): el tipo recién elegido sobrevive al reset.
  const resetAdd = () => {
    resetAddFields();
    setAddError("");
    setAddResetKey((k) => k + 1);
  };

  // Inicializar al abrir (deps propias: no le importan movimiento/initialView, eso es de Edición).
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el form con la prop `open` (reset al abrir), no deriva de otro estado calculable en render
    resetAdd();
    // Tipo inicial según el modo, y encima el prefill del recurrente (que pre-carga todo
    // menos el monto). Un solo parche: antes eran hasta 6 setters encadenados.
    setAddFields({
      ...(reserveMode
        ? { tipo: (esEURMode ? "CompraEUR" : "CompraUSD") as TipoMovimiento }
        : sinPeriodos
        ? { tipo: "Ingreso" as TipoMovimiento, categoria: "Sueldo" }
        : { tipo: "Gasto" as TipoMovimiento }),
      ...(prefill?.tipo ? { tipo: prefill.tipo } : {}),
      ...(prefill?.categoria ? { categoria: prefill.categoria } : {}),
      ...(prefill?.descripcion ? { descripcion: prefill.descripcion } : {}),
      ...(prefill?.observaciones ? { observaciones: prefill.observaciones } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reserveMode, prefill]);

  const aplicarPlantilla = (p: Plantilla) => {
    // Un solo parche (antes eran 6 setters seguidos = 6 renders del form).
    // Monto: si la plantilla lo tiene, precargar; si no, dejar el campo como está (vacío).
    setAddFields({
      tipo: p.tipo ?? "Gasto", // plantillas viejas sin tipo = Gasto
      categoria: p.categoria,
      descripcion: p.nombre,
      medioPago: p.medioPago,
      observaciones: p.observaciones ?? "",
      ...(p.monto != null && p.monto > 0 ? { monto: String(p.monto) } : {}),
    });
    if (user?.uid) {
      usarPlantilla(user.uid, p.id).then(() => {
        mutatePlantillas((prev) => {
          const updated = prev.map((x) => x.id === p.id ? { ...x, usageCount: (x.usageCount ?? 0) + 1 } : x);
          return [...updated].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
        });
      }).catch(() => {});
    }
  };

  const guardarComoPlantilla = async () => {
    // Plantillas para Gasto e Ingreso. Requiere categoría; el monto es OPCIONAL.
    if (!user?.uid || (tipo !== "Gasto" && tipo !== "Ingreso") || !categoria) return;
    const montoNum = parseFloat(monto || "0");
    await crearPlantilla(user.uid, {
      nombre: descripcion.trim() || categoria,
      categoria,
      tipo,
      ...(montoNum > 0 ? { monto: montoNum } : {}), // sin monto → no se guarda el campo
      medioPago,
      ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
    });
    setTplSavedFlash(true);
    setTimeout(() => setTplSavedFlash(false), 1800);
    refreshPlantillas();
  };

  const confirmarBorrarPlantilla = async () => {
    if (!user?.uid || !tplDelete) return;
    await eliminarPlantilla(user.uid, tplDelete.id);
    mutatePlantillas((prev) => prev.filter((x) => x.id !== tplDelete.id));
    setTplDelete(null);
  };

  const esSueldo = tipo === "Ingreso" && categoria === "Sueldo";
  const esAhorros = tipo === "Ingreso" && categoria === "Ahorros";
  const esMove = tipo === "Move";
  // Derivaciones FX: utils/movement-fx (puras y testeadas). Compra/Venta usan el form con
  // cotización (cantidad + cotización → ARS); Gasto/Ingreso FX sólo cantidad (suman/restan
  // a la reserva, sin tocar el disponible).
  const { esFX: esUSD, esCompraOVenta, esSoloCantidad: esSoloCantidadFX, moneda: fxLabel } = fxFlags(tipo);
  const esCompraFX = tipo === "CompraUSD" || tipo === "CompraEUR";
  const esGastoFX = tipo === "GastoUSD" || tipo === "GastoEUR";
  const esVentaFX = tipo === "VentaUSD" || tipo === "VentaEUR";
  const esIngresoFX = tipo === "IngresoUSD" || tipo === "IngresoEUR";
  const tipoColor = TIPOS.find((tx) => tx.t === tipo)?.color ?? "var(--accent)";

  const categoriasFiltradas = tipo === "Gasto"
    ? (config?.categorias.filter((c) => c.tipo === "Gasto" && c.activa) ?? [])
    : tipo === "Ingreso"
    ? (sinPeriodos
       ? [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true }]
       : [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true },
          { id: "ahorros", nombre: "Ahorros", tipo: "Ingreso" as const, activa: true }])
    : [];

  const cotizActual = cotizManual ? num(cotizManual) : (fxLabel === "EUR" ? cotizacion?.oficial_euro : cotizacion?.oficial) ?? 0;
  const { cantidad: usdFinal, ars: arsCompraUSD } = calcularFX({
    tipo, modoCarga, cantidadFX: cantidadUSD, montoARS: montoARSInput, cotizacion: cotizActual,
  });

  // Reserva FX actual (misma cuenta que Inversión): compras − gastos/ventas, sin saldo base.
  const reservaActualFX = useMemo(() => {
    if (!reserveMode) return 0;
    return reservaFX(movimientos, esEURMode ? "EUR" : "USD");
  }, [reserveMode, esEURMode, movimientos]);

  // Frecuencia de uso por categoría de gasto (para ordenar las pills).
  const catUso = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of movimientos) {
      if (mv.tipo === "Gasto" && mv.categoria) m.set(mv.categoria, (m.get(mv.categoria) ?? 0) + 1);
    }
    return m;
  }, [movimientos]);

  // Frecuencia de uso por origen de ahorro (para ordenar las pills por más usado).
  const origenUso = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of movimientos) {
      const o = (mv as Movimiento & { origenAhorro?: string }).origenAhorro;
      if (o) m.set(o, (m.get(o) ?? 0) + 1);
    }
    return m;
  }, [movimientos]);

  // El dueño cobra sueldo mensual: su sueldo SIEMPRE abre período (sin elección),
  // igual que el primer sueldo. El resto de los usuarios eligen con el toggle.
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const forzarNuevoPeriodo = esSueldo && (sinPeriodos || isOwner);
  const abrePeriodo = esSueldo && (forzarNuevoPeriodo || abreNuevoPeriodo);
  // Sueldo del dueño: descripción y medio de pago fijos ("Sueldo" / Débito). Se ocultan
  // sus campos del form; observaciones queda libre; sin opción de recurrente.
  const sueldoOwner = isOwner && esSueldo;
  // Ingreso sin categoría elegida todavía: las dos opciones (Sueldo y Ahorros) resuelven la
  // descripción por su cuenta, así que mostrarla en el paso previo es ofrecer un campo que
  // va a desaparecer apenas elija. Se espera a que haya categoría.
  const ingresoSinCategoria = tipo === "Ingreso" && !categoria;

  const canSubmit = (!!periodoActual || abrePeriodo) && (
    esSoloCantidadFX ? usdFinal > 0 :
    esCompraOVenta ? usdFinal > 0 && arsCompraUSD > 0 :
    esMove ? parseFloat(monto || "0") > 0 :
    !!categoria && parseFloat(monto || "0") > 0
  );

  // Quién puede adjuntar comprobantes: el dueño siempre, o quien tenga el permiso
  // habilitado por el dueño (default OFF para no-dueños). Ver panel Admin.
  const canComprobante = isOwner || config?.meta.permisos?.comprobantes === true;

  // % REAL del presupuesto de la categoría elegida, sumando el monto que se está tipeando —
  // solo para Gasto (Ingreso/Move/FX no tienen presupuesto). null si la categoría no tiene
  // presupuesto puesto (chip no se muestra).
  const pctPresupuesto = tipo === "Gasto" && categoria && presupuestoEfectivo
    ? pctPresupuestoCategoria(categoria, gastadoPorCategoria, presupuestoEfectivo, num(monto))
    : null;

  // Sugerencias de descripción para Gasto: descripciones ya usadas (filtradas por
  // la categoría elegida si hay una), ordenadas por frecuencia. Autocompletado nativo.
  const descSuggestions = useMemo(() => {
    if (tipo !== "Gasto") return [] as string[];
    const counts = new Map<string, number>();
    for (const m of movimientos) {
      if (m.tipo === "Gasto" && m.descripcion && (!categoria || m.categoria === categoria)) {
        counts.set(m.descripcion, (counts.get(m.descripcion) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 8);
  }, [movimientos, categoria, tipo]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    // Validación síncrona: si algo falla, el sheet queda abierto con el error.
    if (!user?.uid) { setAddError(t.errNotAuth); return; }
    if (!esMove && !esUSD && !categoria) { setAddError(t.errSelectCat); return; }
    const montoFinal = esCompraOVenta ? arsCompraUSD : esSoloCantidadFX ? 0 : num(monto);
    if (!esSoloCantidadFX && (!montoFinal || montoFinal <= 0)) { setAddError(t.errInvalidAmount); return; }
    if (esUSD && (!usdFinal || usdFinal <= 0)) { setAddError(t.errInvalidFX(fxLabel)); return; }
    const periodoIdFinal = abrePeriodo ? fechaAPeriodoId(fecha) : (periodoActual?.periodoId ?? null);
    if (!periodoIdFinal) { setAddError(t.errNoActivePeriod); return; }

    // Pulso de confirmación sobre el botón de guardar: acá ya está todo validado y el guardado
    // va sí o sí. Se dispara antes del await para que el rebote acompañe al toque.
    feedback("success", (e.currentTarget as HTMLFormElement | null)?.querySelector<HTMLElement>('button[type="submit"]'));

    const uid = user.uid;
    const now = new Date();
    const file = canComprobante ? comprobante.file : null; // capturar antes del reset

    // Construir los movimientos con id pre-generado (se muestran YA; el comprobante se
    // parchea después de subirlo). main + eventual RESTO de cierre.
    const created: Movimiento[] = [];
    const mainId = nuevoMovimientoId(uid);
    const mainData: Omit<Movimiento, "id"> = {
      timestampCarga: now, fecha, tipo,
      categoria: esMove ? "Move" : esUSD ? tipo : categoria,
      descripcion: sueldoOwner ? "Sueldo" : esMove ? (moveDir === "aAhorro" ? "Move a ahorros" : "Move a disponible") : esCompraFX ? `Compra ${fxLabel}` : esGastoFX ? `Gasto ${fxLabel}` : esVentaFX ? `Venta ${fxLabel}` : esIngresoFX ? `Ingreso ${fxLabel}` : esAhorros ? (origenAhorro || descripcion.trim()) : descripcion.trim(),
      monto: montoFinal,
      medioPago: sueldoOwner ? "Débito" : esMove || esCompraFX || esVentaFX ? "Mercado Pago" : esGastoFX || esIngresoFX ? "—" : medioPago,
      observaciones, periodoId: periodoIdFinal, userId: uid,
      ...(esMove ? { direccionMove: moveDir } : {}),
      ...(esAhorros && origenAhorro ? { origenAhorro } : {}),
      ...(esCompraOVenta ? { cantidadUSD: usdFinal, cotizacion: cotizActual } : {}),
      ...(esSoloCantidadFX ? { cantidadUSD: usdFinal } : {}),
    };
    created.push({ ...mainData, id: mainId });

    if (abrePeriodo && !sinPeriodos && periodoActual && periodoActual.disponible > 0) {
      // Cierre del período anterior: el disponible sobrante se arrastra como RESTO
      // (Move a ahorros; agruparPorPeriodo no lo resta del disponible del nuevo período).
      const restoData: Omit<Movimiento, "id"> = {
        timestampCarga: now, fecha, tipo: "Move", direccionMove: "aAhorro",
        categoria: "RESTO", descripcion: "Resto período anterior",
        monto: periodoActual.disponible,
        medioPago: "—", observaciones: `de ${periodoActual.periodoId}`,
        periodoId: periodoIdFinal, userId: uid,
      };
      created.push({ ...restoData, id: nuevoMovimientoId(uid) });
    }

    // Snapshot del recurrente antes del reset (usa estado del form).
    const recurrenteData = (repetir && (tipo === "Gasto" || tipo === "Ingreso") && categoria !== "Ahorros" && descripcion.trim())
      ? { descripcion: descripcion.trim(), categoria, tipo, observaciones: observaciones.trim(), monto: montoFinal }
      : null;

    // ── Optimista: mostrar y cerrar YA; persistir en background. ──
    resetAdd();
    if (onCreated) onCreated(created); else onChanged();
    onClose();

    (async () => {
      try {
        await Promise.all(created.map(({ id, ...data }) => crearMovimientoConId(uid, id, data)));
      } catch (err) {
        console.error("[handleAdd] fallo al persistir, revierto", err);
        created.forEach((m) => onDeleted?.(m.id)); // rollback del alta optimista
        setBgError(t.errSaveFailed);
        return;
      }
      if (recurrenteData) upsertRecurrente(uid, recurrenteData).then(refreshRecurrentes).catch(() => {});
      // Comprobante: subir en background y parchear la URL (recuperable si falla).
      if (file) await subirComprobante(mainId, file);
    })();
  };

  const title = reserveMode ? t.reserve : t.newMovement;

  return (
    <>
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={handleAdd}>
        {prefillYaCargadoDias !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "9px 12px", background: "var(--yellow-dim)", border: "1px solid var(--yellow)", borderRadius: "var(--radius-sm)", color: "var(--yellow)", fontSize: 12, fontWeight: 600 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            {t.prefillAlreadyLoaded(prefillYaCargadoDias)}
          </div>
        )}
        {reserveMode ? (
          /* Reserva: TIPO a todo el ancho (Compra/Ingreso verdes, Venta/Gasto rojos). */
          <div style={{ marginBottom: 16 }}>
            <div className="label">{t.type}</div>
            <div style={{ display: "flex", gap: 5 }}>
              {TIPOS.map(({ t: tt, label, color }) => (
                <button key={tt} type="button" onClick={() => { setTipo(tt); resetAdd(); }}
                  className="pill" style={{
                    flex: 1, minWidth: 0, height: 42, padding: "0 4px", fontSize: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderColor: tipo === tt ? color : "var(--border)",
                    background: tipo === tt ? color + "22" : "transparent",
                    color: tipo === tt ? color : "var(--muted)",
                  }}>{label}</button>
              ))}
            </div>
          </div>
        ) : (<>
        <div style={{ display: "grid", gridTemplateColumns: (tipo === "Gasto" || tipo === "Ingreso") ? "4fr 1fr" : "1fr", gap: 10, marginBottom: 18, alignItems: "end" }}>
          <div>
            <div className="label">{t.type}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(sinPeriodos ? TIPOS.filter((x) => x.t === "Ingreso") : TIPOS).map(({ t: tt, label, color }) => {
                const sel = tipo === tt;
                const isMove = tt === "Move";
                return (
                  <button key={tt} type="button" onClick={() => { setTipo(tt); resetAdd(); if (sinPeriodos) setCategoria("Sueldo"); }}
                    className="pill" style={sel && isMove ? {
                      border: "1px solid transparent",
                      backgroundImage: "linear-gradient(var(--surface), var(--surface)), linear-gradient(90deg, var(--teal), var(--purple))",
                      backgroundOrigin: "padding-box, border-box",
                      backgroundClip: "padding-box, border-box",
                      color: "var(--text)",
                    } : {
                      borderColor: sel ? color : "var(--border)",
                      background: sel ? color + "22" : "transparent",
                      color: sel ? color : "var(--muted)",
                    }}>{label}</button>
                );
              })}
            </div>
          </div>
          {(tipo === "Gasto" || tipo === "Ingreso") && (() => {
            // Se puede guardar sin monto: alcanza con la categoría.
            const ready = !!categoria;
            return (
              <button type="button" onClick={ready ? guardarComoPlantilla : undefined} disabled={!ready} aria-label={t.tplSave} title={t.tplSave} style={{
                width: "100%", minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${tplSavedFlash ? "var(--green)" : "var(--border)"}`, borderRadius: 999,
                background: "transparent", color: tplSavedFlash ? "var(--green)" : ready ? "var(--text)" : "var(--muted)",
                cursor: ready ? "pointer" : "default", padding: "4px",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill={tplSavedFlash ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            );
          })()}
        </div>

        {/* Plantillas del tipo actual (Gasto o Ingreso): tap precarga el form; × borra.
            Las viejas sin `tipo` cuentan como Gasto. */}
        {(tipo === "Gasto" || tipo === "Ingreso") && (() => {
          const tplsDelTipo = plantillas.filter((p) => (p.tipo ?? "Gasto") === tipo);
          return tplsDelTipo.length > 0 ? (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none" }}>
            {tplsDelTipo.map((p) => (
              <div key={p.id} className="pill" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, borderColor: "var(--border)", padding: "5px 8px 5px 12px" }}>
                <button type="button" onClick={() => aplicarPlantilla(p)} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", fontSize: 12, padding: 0 }}>
                  {p.nombre}
                </button>
                <button type="button" aria-label={t.tplDelete} onClick={() => setTplDelete(p)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
              </div>
            ))}
          </div>
          ) : null;
        })()}

        {/* Monto + Fecha — el monto es el primer dato; la fecha al lado (ya viene cargada). */}
        <div style={{ display: "grid", gridTemplateColumns: esUSD ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {!esUSD && (
            <div>
              <div className="label">{t.amount}</div>
              <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
            </div>
          )}
          <div>
            <div className="label">{t.date}</div>
            <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        </>)}

        {esMove && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {([["aDisponible", t.moveDirToDisponible], ["aAhorro", t.moveDirToAhorro]] as const).map(([d, label]) => {
                const dc = d === "aAhorro" ? "var(--purple)" : "var(--teal)";
                const dd = d === "aAhorro" ? "var(--purple-dim)" : "var(--teal-dim)";
                return (
                  <button key={d} type="button" onClick={() => setMoveDir(d)} className="pill" style={{
                    flex: 1,
                    borderColor: moveDir === d ? dc : "var(--border)",
                    background: moveDir === d ? dd : "transparent",
                    color: moveDir === d ? dc : "var(--muted)",
                  }}>{label}</button>
                );
              })}
            </div>
            {(() => {
              const ac = moveDir === "aAhorro" ? "var(--purple)" : "var(--teal)";
              const ad = moveDir === "aAhorro" ? "var(--purple-dim)" : "var(--teal-dim)";
              return (
            <div style={{ background: ad, border: `1px solid ${ac}44`, borderRadius: "var(--radius-sm)", padding: 12, fontSize: 12, color: ac }}>
              {moveDir === "aAhorro" ? t.moveToSavings : t.moveFromSavings}
              {periodoActual && (
                <div style={{ color: "var(--muted)", marginTop: 4 }}>
                  {moveDir === "aAhorro" ? t.availableBalance(money(periodoActual.disponible)) : t.savingsBalance(money(ahorrosAcumActivo))}
                </div>
              )}
            </div>
              );
            })()}
          </div>
        )}

        {!esMove && !esUSD && (
          <div style={{ marginBottom: 18 }}>
            <div className="label">{t.category}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
              {[...categoriasFiltradas].sort((a, b) => (catUso.get(b.nombre) ?? 0) - (catUso.get(a.nombre) ?? 0)).map((c) => (
                <button key={c.nombre} type="button" onClick={() => setCategoria(c.nombre)}
                  className="pill" style={{
                    flexShrink: 0,
                    borderColor: categoria === c.nombre ? tipoColor : "var(--border)",
                    background: categoria === c.nombre ? tipoColor + "22" : "transparent",
                    color: categoria === c.nombre ? tipoColor : "var(--muted)",
                  }}>{c.nombre}</button>
              ))}
            </div>
            {pctPresupuesto != null && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
                padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                color: colorPct(pctPresupuesto), background: colorPctDim(pctPresupuesto),
              }}>
                {t.budgetCategoryPct(pctPresupuesto, categoria)}
              </div>
            )}
          </div>
        )}

        {/* Sueldo: dónde se imputa el período. El dueño y el primer sueldo
            siempre abren período (solo aviso). El resto elige con el toggle. */}
        {esSueldo && (sinPeriodos || isOwner) && (
          <div style={{ background: "var(--green-dim)", border: "1px solid var(--green)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 16, fontSize: 12, color: "var(--green)", lineHeight: 1.7 }}>
            {sinPeriodos ? t.salaryOpensFirstPeriod : t.salaryOpensPeriod}
          </div>
        )}
        {esSueldo && !sinPeriodos && !isOwner && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {([false, true] as const).map((nuevo) => (
                <button key={String(nuevo)} type="button" onClick={() => setAbreNuevoPeriodo(nuevo)} className="pill" style={{
                  flex: 1,
                  borderColor: abreNuevoPeriodo === nuevo ? "var(--green)" : "var(--border)",
                  background: abreNuevoPeriodo === nuevo ? "var(--green-dim)" : "transparent",
                  color: abreNuevoPeriodo === nuevo ? "var(--green)" : "var(--muted)",
                }}>{nuevo ? t.periodNew : t.periodCurrent}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 2 }}>
              {abreNuevoPeriodo ? t.salaryOpensPeriod : t.salaryToCurrentPeriod}
            </div>
          </div>
        )}

        {esAhorros && (
          <div style={{ marginBottom: 18 }}>
            <div className="label">{t.origin}</div>
            {/* Una sola fila con scroll lateral, ordenada por más usado. */}
            <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
              {[...(config?.origenesAhorro.filter((o) => o.activo) ?? [])]
                .sort((a, b) => (origenUso.get(b.nombre) ?? 0) - (origenUso.get(a.nombre) ?? 0))
                .map((o) => (
                <button key={o.nombre} type="button" onClick={() => setOrigenAhorro(o.nombre)}
                  className="pill" style={{
                    flexShrink: 0,
                    borderColor: origenAhorro === o.nombre ? "var(--blue)" : "var(--border)",
                    background: origenAhorro === o.nombre ? "var(--blue-dim)" : "transparent",
                    color: origenAhorro === o.nombre ? "var(--blue)" : "var(--muted)",
                  }}>{o.nombre}</button>
              ))}
            </div>
          </div>
        )}

        {esCompraOVenta && (
          <div style={{ marginBottom: 18 }}>
            {/* Ingresar en + Cotización en un solo grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <div className="label">{t.addTo}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {([fxLabel, "ARS"] as const).map((mo) => (
                    <button key={mo} type="button" onClick={() => setModoCarga(mo === "ARS" ? "ARS" : "USD")} className="pill" style={{
                      flex: 1,
                      borderColor: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow)" : "var(--border)",
                      background: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow-dim)" : "transparent",
                      color: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow)" : "var(--muted)",
                    }}>{mo}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label">{t.date}</div>
                <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div className="label">{modoCarga === "USD" ? fxLabel : "ARS"}</div>
                {modoCarga === "USD" ? (
                  <input className="input" type="number" value={cantidadUSD} onChange={(e) => setCantidadUSD(e.target.value)} placeholder="0" />
                ) : (
                  <input className="input" type="number" value={montoARSInput} onChange={(e) => setMontoARSInput(e.target.value)} placeholder="0" />
                )}
              </div>
              <div>
                <div className="label">{t.exchangeRate}</div>
                <input className="input" type="number" value={cotizManual || String((fxLabel === "EUR" ? cotizacion?.oficial_euro : cotizacion?.oficial) ?? "")} onChange={(e) => setCotizManual(e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="label">{modoCarga === "USD" ? "Total ARS" : t.equalTo(fxLabel)}</div>
            <div style={{ padding: "12px 14px", background: "var(--yellow-dim)", border: "1px solid var(--yellow)33", borderRadius: "var(--radius-sm)", fontSize: 14, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
              {modoCarga === "USD"
                ? (arsCompraUSD > 0 ? formatARS(arsCompraUSD) : "—")
                : (usdFinal > 0 ? `${fxLabel} ${usdFinal.toFixed(2)}` : "—")}
            </div>
            {periodoActual && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                {t.available}: <span style={{ fontFamily: "var(--font-mono)" }}>{money(periodoActual.disponible)}</span>
                {arsCompraUSD > 0 && esVentaFX && (
                  <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: "var(--green)" }}>{money(periodoActual.disponible + arsCompraUSD)}</span></>
                )}
                {arsCompraUSD > 0 && esCompraFX && (() => {
                  const ratio = periodoActual.disponible > 0 ? arsCompraUSD / periodoActual.disponible : 1;
                  const restoColor = ratio < 0.30 ? "var(--green)" : ratio <= 0.70 ? "var(--yellow)" : "var(--red)";
                  return <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: restoColor }}>{money(periodoActual.disponible - arsCompraUSD)}</span></>;
                })()}
              </div>
            )}
          </div>
        )}

        {esSoloCantidadFX && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <div className="label">{esIngresoFX ? t.fxAmountReceived(fxLabel) : t.fxAmountSpent(fxLabel)}</div>
                <input className="input" type="number" value={cantidadUSD} onChange={(e) => setCantidadUSD(e.target.value)} placeholder="0" style={{ fontFamily: "var(--font-mono)" }} />
              </div>
              <div>
                <div className="label">{t.date}</div>
                <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              {t.reserve}: <span style={{ fontFamily: "var(--font-mono)" }}>{fxLabel} {reservaActualFX.toFixed(2)}</span>
              {usdFinal > 0 && (esIngresoFX
                ? <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: "var(--green)" }}>{fxLabel} {(reservaActualFX + usdFinal).toFixed(2)}</span></>
                : (() => {
                    const queda = reservaActualFX - usdFinal;
                    const ratio = reservaActualFX > 0 ? usdFinal / reservaActualFX : 1;
                    const color = ratio < 0.30 ? "var(--green)" : ratio <= 0.70 ? "var(--yellow)" : "var(--red)";
                    return <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color }}>{fxLabel} {queda.toFixed(2)}</span></>;
                  })())}
            </div>
          </div>
        )}

        {!esMove && !esUSD && !esAhorros && !sueldoOwner && !ingresoSinCategoria && (
          <div style={{ marginBottom: 14 }}>
            <div className="label">{t.description}</div>
            <input className="input" type="text" list="finmoves-desc-sug" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} autoComplete="off" />
            {descSuggestions.length > 0 && (
              <datalist id="finmoves-desc-sug">
                {descSuggestions.map((d) => <option key={d} value={d} />)}
              </datalist>
            )}
          </div>
        )}
        {!esMove && !esUSD && !sueldoOwner && (
          <div style={{ marginBottom: 14 }}>
            <div className="label">{t.paymentMethod}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {config?.mediosPago.filter((m) => m.activo).map((m) => (
                <button key={m.nombre} type="button" onClick={() => setMedioPago(m.nombre)}
                  className="pill" style={{
                    borderColor: medioPago === m.nombre ? "var(--accent)" : "var(--border)",
                    background: medioPago === m.nombre ? "var(--accent-dim)" : "transparent",
                    color: medioPago === m.nombre ? "var(--accent)" : "var(--muted)",
                  }}>{m.nombre}</button>
              ))}
            </div>
          </div>
        )}

        {addError && (
          <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 14, fontSize: 12, color: "var(--red)" }}>
            {addError}
          </div>
        )}

        {/* Observaciones (50%) + comprobante (25%) + enviar (25%) en la misma fila */}
        <div style={{ display: "grid", gridTemplateColumns: canComprobante ? "50% 25% 25%" : "70% 30%", gap: 10, alignItems: "end", marginTop: 8 }}>
          <div>
            <div className="label">{t.notes}</div>
            <input className="input" type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
          {canComprobante && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ComprobanteField resetKey={addResetKey} onChange={setComprobante} />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button type="submit" disabled={!canSubmit} aria-label={t.save} style={{
              width: 52, height: 52, borderRadius: "50%",
              background: canSubmit ? "var(--green)" : "transparent",
              border: `2px solid ${canSubmit ? "var(--green)" : "var(--border)"}`,
              color: canSubmit ? "var(--bg)" : "var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: canSubmit ? "pointer" : "default",
              transition: "background 0.2s, border-color 0.2s, color 0.2s",
              boxShadow: canSubmit ? "0 4px 20px var(--green)55" : "none",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>

        {!esMove && !esUSD && !esAhorros && !sueldoOwner && !ingresoSinCategoria && (
          yaEsRecurrente ? (
            // Ya es recurrente: no ofrecemos "repetir", solo informamos que lo es (con ícono).
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)", color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
              {t.recurrentMovement}
            </div>
          ) : (
            <button type="button" onClick={() => setRepetir(!repetir)} style={{
              marginTop: 16, display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 11px",
              background: repetir ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${repetir ? "var(--accent)" : "var(--border)"}`, borderRadius: "var(--radius-sm)",
              color: repetir ? "var(--accent)" : "var(--muted)", cursor: "pointer", fontSize: 13, textAlign: "left",
            }}>
              <span style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 4, border: `1px solid ${repetir ? "var(--accent)" : "var(--border-hi)"}`, background: repetir ? "var(--accent)" : "transparent" }} />
              <span style={{ flex: 1 }}>{t.repeatEachPeriod}</span>
            </button>
          )
        )}
        {/* Sugerencia pasiva: mismo patrón 3+ períodos sin marcar. Se calla sola si el
            usuario tilda "repetir" (ya no hace falta insistir) o si deja de cumplir el patrón. */}
        {sugerenciaRecurrente && !repetir && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", paddingLeft: 2 }}>
            {t.recurrentSuggestion}
          </div>
        )}
      </form>
    </Sheet>

    {tplDelete && (
      <ConfirmModal title={t.tplDelete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)"
        onConfirm={confirmarBorrarPlantilla} onCancel={() => setTplDelete(null)}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>{t.tplDeleteConfirm}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{tplDelete.nombre}</div>
        </div>
      </ConfirmModal>
    )}
    {(pendingReceipt || bgError) && (
      <div role="alert" style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom, 0px) + 16px)", zIndex: 300,
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)",
        borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600,
        boxShadow: "0 6px 24px rgba(0,0,0,0.3)", maxWidth: "92%",
      }}>
        <span>{pendingReceipt ? t.errReceiptFailed : bgError}</span>
        {pendingReceipt && (
          <button onClick={() => subirComprobante(pendingReceipt.movId, pendingReceipt.file)}
            style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>{t.retry}</button>
        )}
        <button onClick={() => { setPendingReceipt(null); setBgError(null); }} aria-label={t.cancel}
          style={{ background: "none", border: "none", color: "var(--red)", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0, flexShrink: 0 }}>×</button>
      </div>
    )}
    </>
  );
}
