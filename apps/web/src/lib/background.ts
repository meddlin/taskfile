export type Background = "plain" | "notebook" | "aurora" | "horizon";

export interface BackgroundOption {
  value: Background;
  label: string;
  description: string;
}

export const BACKGROUND_OPTIONS: readonly BackgroundOption[] = [
  { value: "plain", label: "Plain", description: "No background, just the theme colour." },
  { value: "notebook", label: "Notebook", description: "Architect's graph paper with quiet quadrant lines." },
  { value: "aurora", label: "Aurora", description: "Soft, slow-moving washes of colour." },
  { value: "horizon", label: "Horizon", description: "A calm gradient with a single hairline horizon." },
];

export const BACKGROUND_STORAGE_KEY = "taskfile-background";

// Stored values come from localStorage, so anything unrecognised falls back to the plain background.
export function parseBackground(value: string | null | undefined): Background {
  return BACKGROUND_OPTIONS.some((o) => o.value === value) ? (value as Background) : "plain";
}

// Runs inline in <head> before first paint so a saved choice never flashes the plain background.
// Must stay self-contained: it is serialised into the page, not bundled.
export function backgroundInitScript(): string {
  const known = JSON.stringify(BACKGROUND_OPTIONS.map((o) => o.value));
  return `(function(){try{var b=localStorage.getItem(${JSON.stringify(BACKGROUND_STORAGE_KEY)});` +
    `if(${known}.indexOf(b)>0)document.documentElement.dataset.background=b;}catch(e){}})();`;
}

// Sets the background on <html>; "plain" removes the attribute so the stylesheet default applies.
export function applyBackground(background: Background, root: HTMLElement = document.documentElement): void {
  if (background === "plain") delete root.dataset.background;
  else root.dataset.background = background;
}
