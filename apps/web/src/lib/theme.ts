export type Theme = "light" | "dark" | "system";

export const THEMES: readonly Theme[] = ["light", "dark", "system"];
export const THEME_STORAGE_KEY = "taskfile-theme";

// Stored values come from localStorage, so anything unrecognised falls back to following the OS.
export function parseTheme(value: string | null | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

export function isDark(theme: Theme, systemPrefersDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark);
}

// Runs inline in <head> before first paint so a saved choice never flashes the wrong theme.
// Must stay self-contained: it is serialised into the page, not bundled.
export function themeInitScript(): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);` +
    `document.documentElement.classList.toggle("dark",d);` +
    `document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
}

// Applies the theme to <html> and returns whether dark is now active.
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): boolean {
  const dark = isDark(theme, matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  return dark;
}
