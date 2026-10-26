import { describe, expect, it } from "vitest";
import { canCheck, describeUpdateState, type UpdateState } from "./desktop-updates";

const base: UpdateState = { phase: "idle", currentVersion: "0.1.0", supported: true, autoCheck: true, allowPrerelease: false };

describe("describeUpdateState", () => {
  it("explains why updating is unavailable instead of describing a phase", () => {
    const state = { ...base, supported: false, unsupportedReason: "only in the installed app.", phase: "checking" as const };
    expect(describeUpdateState(state)).toBe("only in the installed app.");
  });

  it("tells a fresh install from one that has checked", () => {
    expect(describeUpdateState(base)).toContain("not checked yet");
    expect(describeUpdateState({ ...base, lastCheckedAt: "2026-10-26T12:00:00Z" })).toBe("taskfile 0.1.0 is up to date.");
  });

  it("names the version, and says so when it is a pre-release", () => {
    const offer = { ...base, phase: "available" as const, version: "0.2.0-rc.1" };
    expect(describeUpdateState(offer)).toBe("version 0.2.0-rc.1 is available.");
    expect(describeUpdateState({ ...offer, prerelease: true })).toBe("pre-release version 0.2.0-rc.1 is available.");
  });

  it("shows download progress as whole percent", () => {
    const state = { ...base, phase: "downloading" as const, version: "0.2.0", percent: 41.6 };
    expect(describeUpdateState(state)).toBe("downloading version 0.2.0… 42%");
  });
});

describe("canCheck", () => {
  it("is off while a check or download runs, and where updates are unsupported", () => {
    for (const phase of ["checking", "downloading", "ready"] as const) expect(canCheck({ ...base, phase })).toBe(false);
    expect(canCheck({ ...base, supported: false })).toBe(false);
  });

  it("is on when idle, after an error, and when an offer is showing", () => {
    for (const phase of ["idle", "error", "available"] as const) expect(canCheck({ ...base, phase })).toBe(true);
  });
});
