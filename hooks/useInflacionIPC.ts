"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY = "finmoves.ipc.v2"; // v2: pasa por /api/ipc; invalida cache viejo (roto por CORS)
const TTL = 24 * 60 * 60 * 1000;

type IpcEntry = { fecha: string; valor: number }; // "YYYY-MM" → cumulative index

// El período arranca el día del sueldo (casi siempre a fin de mes) y cubre ~1 mes.
// Si arranca pasado el 15, la mayoría de los días caen en el mes SIGUIENTE → usamos
// ese mes para el IPC (el mes que el período realmente abarca, no el de inicio).
function periodoIdToYM(periodoId: string): string {
  const [dStr, mStr, yStr] = periodoId.split("/");
  const d = parseInt(dStr, 10);
  let m = parseInt(mStr, 10), y = parseInt(yStr, 10);
  if (d > 15) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Lee el cache de localStorage si todavía está vigente (TTL). Se usa como inicializador
// perezoso de useState: hidratar desde cache en el render inicial, no en un efecto — así el
// setState del efecto queda reservado para cuando SÍ hace falta pedir datos nuevos.
function cacheVigente(): IpcEntry[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { ts, entries } = JSON.parse(raw) as { ts: number; entries: IpcEntry[] };
    return Date.now() - ts < TTL ? entries : null;
  } catch { return null; }
}

export function useInflacionIPC() {
  const [data, setData] = useState<IpcEntry[] | null>(cacheVigente);
  const yaTeniaCache = useRef(data !== null).current;

  useEffect(() => {
    if (yaTeniaCache) return; // el cache ya lo cubrió al montar — solo pedir si hacía falta

    // Vía ruta propia /api/ipc: argly no manda CORS y el navegador bloquea el fetch directo.
    // El servidor lo trae sin CORS y lo cachea; acá pegamos al mismo origen.
    fetch("/api/ipc")
      .then((r) => r.json())
      .then((json) => {
        const arr = json.data as { anio: number; mes: number; valor: number }[] | undefined;
        if (!Array.isArray(arr) || arr.length === 0) return;
        const sorted = [...arr].sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes);
        let idx = 100;
        const entries: IpcEntry[] = sorted.map(({ anio, mes, valor }) => {
          idx = idx * (1 + valor / 100);
          return { fecha: `${anio}-${String(mes).padStart(2, "0")}`, valor: idx };
        });
        setData(entries);
        localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), entries }));
      })
      .catch((e) => { console.warn("[ipc] no se pudo cargar la inflación", e); });
    // yaTeniaCache es fijo (useRef tomado en el primer render): correr esto una sola vez al
    // montar es la intención, por eso se omite de las deps.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deflatar = useCallback(
    (monto: number, periodoId: string): number => {
      if (!data || data.length === 0) return monto;
      const ym = periodoIdToYM(periodoId);
      const latest = data[data.length - 1]!;
      const entry = data.find((e) => e.fecha === ym)
        ?? [...data].reverse().find((e) => e.fecha <= ym)
        ?? null;
      if (!entry) return monto;
      return monto * (latest.valor / entry.valor);
    },
    [data]
  );

  // Inflación del país (IPC acumulado) entre los meses de dos períodos.
  // Devuelve el % de variación del índice, o null si no hay datos.
  const ipcVar = useCallback(
    (prevPeriodoId: string, currPeriodoId: string): number | null => {
      if (!data || data.length === 0) return null;
      const find = (id: string) => {
        const ym = periodoIdToYM(id);
        return data.find((e) => e.fecha === ym)
          ?? [...data].reverse().find((e) => e.fecha <= ym)
          ?? null;
      };
      const a = find(prevPeriodoId), b = find(currPeriodoId);
      if (!a || !b || a.valor <= 0) return null;
      return (b.valor / a.valor - 1) * 100;
    },
    [data]
  );

  // Última variación mensual conocida del IPC (para proyectar al próximo período).
  const ipcMensualUltimo = data && data.length >= 2
    ? (data[data.length - 1]!.valor / data[data.length - 2]!.valor - 1) * 100
    : null;

  return { deflatar, ipcVar, ipcMensualUltimo, ipcDisponible: !!data };
}
