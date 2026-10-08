import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark";

const useThemeStore = create<{ theme: Theme; toggle: () => void }>((set) => ({
  theme: (document.documentElement.dataset.theme as Theme) ?? "dark",
  toggle: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));

export const toggleTheme = () => useThemeStore.getState().toggle();

/** Shared theme state; applies it to <html> and remembers it. */
export function useTheme() {
  const { theme, toggle } = useThemeStore();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0B0D10" : "#FAFAF9");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  return { theme, toggle };
}
