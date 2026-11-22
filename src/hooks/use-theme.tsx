/**
 * Theme: Light, Dark or System. The explicit choice is persisted; "system" follows
 * prefers-color-scheme live. The initial theme is applied by an inline script in
 * index.html before first paint, so there is no flash of the wrong theme.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
const KEY = 'br.theme';
const META: Record<ResolvedTheme, string> = { light: '#f6f5f1', dark: '#0b0a09' };

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}
const systemTheme = (): ResolvedTheme => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[resolved]);
}

interface ThemeCtx {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);
  const resolved: ResolvedTheme = preference === 'system' ? system : preference;

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = () => setSystem(mq.matches ? 'dark' : 'light');
    mq?.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);

  useEffect(() => applyTheme(resolved), [resolved]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const on = (e: StorageEvent) => e.key === KEY && setPref(readPreference());
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* storage unavailable: still applies for this session */
    }
    setPref(p);
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
