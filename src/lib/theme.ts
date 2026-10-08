import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) ?? "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0B0D10" : "#FAFAF9");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
