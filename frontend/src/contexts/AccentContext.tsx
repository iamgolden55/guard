import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { accents, DEFAULT_ACCENT, type AccentName } from "../design-system/accents";

interface AccentContextValue {
  accent: AccentName;
  setAccent: (a: AccentName) => void;
  palette: (typeof accents)[AccentName];
}

const AccentContext = createContext<AccentContextValue | null>(null);

const STORAGE_KEY = "ms-accent";

function readStored(): AccentName {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in accents) return v as AccentName;
  } catch {
    // localStorage unavailable (SSR / private mode)
  }
  return DEFAULT_ACCENT;
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentName>(() => readStored());

  // Reflect the current accent on <html> so [data-accent="..."] CSS-var
  // selectors in tokens.css apply across the whole tree.
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setAccent = (next: AccentName) => {
    setAccentState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const value = useMemo<AccentContextValue>(
    () => ({ accent, setAccent, palette: accents[accent] }),
    [accent],
  );

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error("useAccent must be used within AccentProvider");
  return ctx;
}
