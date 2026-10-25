import { describe, expect, it } from "vitest";
import { listenMessage } from "../../listen-message.mjs";

describe("listenMessage", () => {
  it("prints the bound URL when running directly on the host", () => {
    expect(listenMessage("http://127.0.0.1:53211/", {})).toBe("Taskfile is running at http://127.0.0.1:53211/");
  });

  it("shows IPv4 loopback instead of the wildcard address on the host", () => {
    expect(listenMessage("http://0.0.0.0:3000/", {})).toBe(
      "Taskfile is running at http://127.0.0.1:3000/ (all interfaces)",
    );
  });

  it("points at the published host port, not the internal one, inside the container", () => {
    const message = listenMessage("http://0.0.0.0:8080/", { TASKFILE_CONTAINER: "1", TASKFILE_PUBLISHED_PORT: "4321" });
    expect(message).toContain("Open http://127.0.0.1:4321/");
    expect(message).not.toContain("http://127.0.0.1:8080");
    expect(message).not.toContain("localhost:8080");
  });

  it("explains how to look up the host port when Docker picked it", () => {
    for (const published of [undefined, ""]) {
      const message = listenMessage("http://0.0.0.0:8080/", { TASKFILE_CONTAINER: "1", TASKFILE_PUBLISHED_PORT: published });
      expect(message).toContain("docker compose port web 8080");
      expect(message).toContain("not reachable from your machine");
      expect(message).not.toMatch(/Open http:\/\/127\.0\.0\.1:8080/);
    }
  });
});
