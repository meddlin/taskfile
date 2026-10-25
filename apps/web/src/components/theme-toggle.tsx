import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import { THEME_STORAGE_KEY, applyTheme, parseTheme, type Theme } from "~/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

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
    <div role="group" aria-label="Theme" className="flex gap-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="icon"
          variant={theme === value ? "secondary" : "ghost"}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          onClick={() => choose(value)}
        >
          <Icon />
        </Button>
      ))}
    </div>
  );
}
