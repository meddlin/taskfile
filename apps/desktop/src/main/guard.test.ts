import { describe, expect, it } from "vitest";
import { checkRequest, TOKEN_HEADER } from "./guard";

const expected = { host: "127.0.0.1:5000", token: "s3cret-token" };

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("checkRequest", () => {
  it("accepts the right host with the right token", () => {
    expect(checkRequest(headers({ host: expected.host, [TOKEN_HEADER]: expected.token }), expected)).toEqual({ ok: true });
  });

  it("rejects a request with no token (another local process or web page)", () => {
    const result = checkRequest(headers({ host: expected.host }), expected);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a wrong token, including one of a different length", () => {
    for (const token of ["s3cret-tokeX", "short", `${expected.token}-and-more`]) {
      expect(checkRequest(headers({ host: expected.host, [TOKEN_HEADER]: token }), expected).ok).toBe(false);
    }
  });

  it("rejects a foreign Host header even with a valid token (DNS rebinding)", () => {
    const result = checkRequest(headers({ host: "evil.example:5000", [TOKEN_HEADER]: expected.token }), expected);
    expect(result).toMatchObject({ ok: false, reason: "Unexpected Host header." });
  });
});
