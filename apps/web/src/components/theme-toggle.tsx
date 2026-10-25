import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { THEMES, THEME_STORAGE_KEY, applyTheme, parseTheme, type Theme } from "~/lib/theme";

export function ThemeToggle() {
  // "system" until mounted so server and client markup match; the init script already painted correctly.
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(parseTheme(localStorage.getItem(THEME_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice still applies for this page view.
    }
  }

  return (
    <div role="group" aria-label="Theme" className="flex gap-2">
      {THEMES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => choose(value)}
          className={cn(
            "cursor-pointer border-b border-transparent py-0.5 transition-colors duration-150 hover:text-foreground",
            theme === value ? "border-accent text-accent" : "text-muted-foreground",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
