"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY = "finmoves.dolar.hist";
const TTL = 24 * 60 * 60 * 1000;

type Entry = { fecha: string; valor: number }; // "YYYY-MM-DD" → oficial (venta)

function periodoIdToISO(periodoId: string): string {
  const [d, m, y] = periodoId.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Lee el cache si todavía está vigente (TTL). Inicializador perezoso de useState: hidratar
// desde cache en el render inicial, no con un setState dentro del efecto.
function cacheVigente(): Entry[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { ts, entries } = JSON.parse(raw) as { ts: number; entries: Entry[] };
    return Date.now() - ts < TTL ? entries : null;
  } catch { return null; }
}

// Histórico del dólar OFICIAL (bluelytics, evolution.json) para convertir el sueldo de
// cada período a USD. Cacheado 24h en localStorage.
export function useDolarHistorico() {
  const [data, setData] = useState<Entry[] | null>(cacheVigente);
  const yaTeniaCache = useRef(data !== null).current;

  useEffect(() => {
    if (yaTeniaCache) return; // el cache ya lo cubrió al montar

    fetch("https://api.bluelytics.com.ar/v2/evolution.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { date: string; source: string; value_sell: number }[]) => {
        const entries = json
          .filter((x) => x.source === "Oficial" && x.value_sell > 0)
          .map((x) => ({ fecha: x.date, valor: x.value_sell }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        if (entries.length === 0) return;
        setData(entries);
        localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), entries }));
      })
      .catch(() => {});
    // yaTeniaCache es fijo (useRef del primer render): correr esto una sola vez al montar.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Oficial del día del período (o el último dato anterior). Null si no hay data.
  const dolarAt = useCallback((periodoId: string): number | null => {
    if (!data || data.length === 0) return null;
    const iso = periodoIdToISO(periodoId);
    let res: number | null = null;
    for (const e of data) { if (e.fecha <= iso) res = e.valor; else break; }
    return res ?? data[0]!.valor;
  }, [data]);

  return { dolarAt, dolarDisponible: !!data };
}
