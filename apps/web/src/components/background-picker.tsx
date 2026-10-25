import { useEffect, useState } from "react";
import {
  BACKGROUND_OPTIONS,
  BACKGROUND_STORAGE_KEY,
  applyBackground,
  parseBackground,
  type Background,
} from "~/lib/background";
import { cn } from "~/lib/utils";

export function BackgroundPicker() {
  // "plain" until mounted so server and client markup match; the init script already painted correctly.
  const [background, setBackground] = useState<Background>("plain");

  useEffect(() => {
    setBackground(parseBackground(localStorage.getItem(BACKGROUND_STORAGE_KEY)));
  }, []);

  function choose(next: Background) {
    setBackground(next);
    applyBackground(next);
    try {
      localStorage.setItem(BACKGROUND_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice still applies for this page view.
    }
  }

  return (
    <div role="group" aria-label="Background" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BACKGROUND_OPTIONS.map(({ value, label, description }) => {
        const selected = background === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => choose(value)}
            className={cn(
              "flex cursor-pointer flex-col gap-2 border p-2 text-left transition-colors duration-150 hover:border-foreground",
              selected ? "border-accent" : "border-border",
            )}
          >
            <span
              aria-hidden
              className={cn("block h-20 w-full border border-border bg-background", value !== "plain" && `backdrop-${value} [--cell:10px]`)}
            />
            <span className={cn("font-bold", selected && "text-accent")}>
              {selected ? "● " : "○ "}
              {label}
            </span>
            <span className="text-muted-foreground">{description}</span>
          </button>
        );
      })}
    </div>
  );
}
