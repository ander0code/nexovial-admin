import {useEffect, useState} from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'nexovial:theme';

function readTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) ?? 'light';
}

/** Aplica el tema al <html> vía data-theme y lo persiste. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;
    // Tailwick controla el color del sidebar con un atributo aparte:
    // 'dark' → zinc-900 (un tono sobre el body zinc-950), da profundidad fina.
    html.dataset.sidenavColor = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme(t => (t === 'light' ? 'dark' : 'light')),
  };
}

/** Lectura puntual del tema actual (para configurar charts). */
export function currentTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) ?? 'light';
}
