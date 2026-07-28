"use client";
import { useEffect, useState } from "react";
import { LIGHT_VARS, THEME_COLOR } from "@/lib/theme-init";

const LS_KEY = "finmoves-theme";

export function applyTheme(isLight: boolean) {
  const root = document.documentElement;
  if (isLight) {
    Object.entries(LIGHT_VARS).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute("data-theme", "light");
  } else {
    Object.keys(LIGHT_VARS).forEach(k => root.style.removeProperty(k));
    root.removeAttribute("data-theme");
  }
  // Mantener la barra del navegador (theme-color) en sintonía con el tema actual.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isLight ? THEME_COLOR.light : THEME_COLOR.dark);
}

export function useTheme() {
  // Dark es el tema por defecto (la paleta diseñada); claro es opt-in. El valor sale del
  // inicializador perezoso (lee localStorage una vez, en el primer render) en vez de un
  // setState dentro del efecto — el efecto queda solo para lo que de verdad le pertenece:
  // sincronizar el DOM (applyTheme) al montar.
  const [dark, setDark] = useState(() => localStorage.getItem(LS_KEY) !== "light");

  useEffect(() => {
    // Solo al montar: aplicar el tema inicial leído arriba. Cambios posteriores van por
    // toggle(), no por este efecto — por eso "dark" se omite de las deps a propósito.
    applyTheme(!dark);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(!next);
    localStorage.setItem(LS_KEY, next ? "dark" : "light");
  };

  return { dark, toggle };
}
