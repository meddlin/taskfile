import { describe, expect, it } from "vitest";
import {
  BACKGROUND_STORAGE_KEY,
  applyBackground,
  backgroundInitScript,
  parseBackground,
  type Background,
} from "./background";

describe("parseBackground", () => {
  it("accepts the known backgrounds", () => {
    for (const value of ["plain", "notebook", "aurora", "horizon"] as Background[]) {
      expect(parseBackground(value)).toBe(value);
    }
  });

  it("falls back to plain for missing or corrupt values", () => {
    expect(parseBackground(null)).toBe("plain");
    expect(parseBackground(undefined)).toBe("plain");
    expect(parseBackground("<script>")).toBe("plain");
  });
});

describe("applyBackground", () => {
  it("sets and clears the data attribute", () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyBackground("notebook", root);
    expect(root.dataset.background).toBe("notebook");
    applyBackground("plain", root);
    expect(root.dataset.background).toBeUndefined();
  });
});

describe("backgroundInitScript", () => {
  function run(stored: string | null) {
    const dataset: Record<string, string> = {};
    const localStorage = { getItem: (k: string) => (k === BACKGROUND_STORAGE_KEY ? stored : null) };
    new Function("document", "localStorage", backgroundInitScript())({ documentElement: { dataset } }, localStorage);
    return dataset.background;
  }

  it("applies a stored background before paint", () => {
    expect(run("aurora")).toBe("aurora");
  });

  it("leaves the attribute off for plain, unknown or missing values", () => {
    expect(run("plain")).toBeUndefined();
    expect(run("bogus")).toBeUndefined();
    expect(run(null)).toBeUndefined();
  });
});
