import React, { createContext, useContext, useEffect } from "react";

export type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

/**
 * Dark mode is locked site-wide. The `dark` class is set on <html> in index.html
 * before first paint (no light-mode flash). This provider keeps the class pinned
 * and exposes a no-op toggle so existing callers don't break.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    root.classList.remove("light");
    try {
      // Clear any stale light preference from earlier builds.
      localStorage.setItem("rr-theme", "dark");
    } catch { /* ignore */ }
  }, []);

  const value: ThemeContextType = {
    theme: "dark",
    isDark: true,
    toggleTheme: () => { /* dark mode locked — intentional no-op */ },
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
