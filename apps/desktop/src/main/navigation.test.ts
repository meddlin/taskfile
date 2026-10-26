import { describe, expect, it } from "vitest";
import { decideNavigation } from "./navigation";

const origin = "http://127.0.0.1:5000";

describe("decideNavigation", () => {
  it("keeps the app's own pages in the window", () => {
    expect(decideNavigation(`${origin}/board`, origin)).toBe("allow");
  });

  it("sends other web links to the user's browser", () => {
    expect(decideNavigation("https://example.com/docs", origin)).toBe("external");
    // Same host, different port is a different origin: some other local service.
    expect(decideNavigation("http://127.0.0.1:9999/", origin)).toBe("external");
  });

  it("refuses everything that isn't http(s) or the app", () => {
    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "smb://host/share", "not a url", ""]) {
      expect(decideNavigation(url, origin)).toBe("deny");
    }
  });
});
