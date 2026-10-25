import { describe, expect, it } from "vitest";
import { fitFrameToWindow } from "./frameSize.js";

describe("fitFrameToWindow", () => {
  it("keeps the configured size when the terminal is larger", () => {
    expect(fitFrameToWindow({ width: 120, height: 40 }, { columns: 200, rows: 60 })).toEqual({ width: 120, height: 40 });
  });

  it("shrinks to the terminal width and leaves one row free when the terminal is smaller", () => {
    expect(fitFrameToWindow({ width: 120, height: 40 }, { columns: 80, rows: 24 })).toEqual({ width: 80, height: 23 });
  });

  it("shrinks each dimension independently", () => {
    expect(fitFrameToWindow({ width: 120, height: 40 }, { columns: 200, rows: 24 })).toEqual({ width: 120, height: 23 });
  });
});
