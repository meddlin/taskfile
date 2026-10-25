import { describe, expect, it } from "vitest";
import { isDark, parseTheme, themeInitScript, THEME_STORAGE_KEY } from "./theme";

describe("parseTheme", () => {
  it("accepts the known themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to system for missing or corrupt values", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("sepia")).toBe("system");
  });
});

describe("isDark", () => {
  it("honours explicit choices regardless of the OS", () => {
    expect(isDark("dark", false)).toBe(true);
    expect(isDark("light", true)).toBe(false);
  });

  it("follows the OS for system", () => {
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
  });
});

describe("themeInitScript", () => {
  function run(stored: string | null, osDark: boolean) {
    const classes = new Set<string>();
    const root = {
      classList: { toggle: (c: string, on: boolean) => void (on ? classes.add(c) : classes.delete(c)) },
      style: {} as { colorScheme?: string },
    };
    const localStorage = { getItem: (k: string) => (k === THEME_STORAGE_KEY ? stored : null) };
    const matchMedia = () => ({ matches: osDark });
    new Function("document", "localStorage", "matchMedia", themeInitScript())({ documentElement: root }, localStorage, matchMedia);
    return { dark: classes.has("dark"), colorScheme: root.style.colorScheme };
  }

  it("applies the stored theme before paint", () => {
    expect(run("dark", false)).toEqual({ dark: true, colorScheme: "dark" });
    expect(run("light", true)).toEqual({ dark: false, colorScheme: "light" });
  });

  it("uses the OS preference when nothing is stored", () => {
    expect(run(null, true).dark).toBe(true);
    expect(run(null, false).dark).toBe(false);
  });
});
