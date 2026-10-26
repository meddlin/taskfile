import { timingSafeEqual } from "node:crypto";

// The web server listens on 127.0.0.1, which any local process and any web page open in the user's
// browser can reach. Two checks keep it to the app's own window:
//  - the Host header must be the address we bound (a DNS-rebinding page sends its own hostname);
//  - every request must carry a per-launch random token. The Electron session adds it to the
//    window's requests (index.ts); nothing else ever sees it.
export const TOKEN_HEADER = "x-taskfile-token";

export type GuardResult = { ok: true } | { ok: false; status: 403; reason: string };

export interface HeaderSource {
  get(name: string): string | null;
}

export function checkRequest(headers: HeaderSource, expected: { host: string; token: string }): GuardResult {
  if (headers.get("host") !== expected.host) {
    return { ok: false, status: 403, reason: "Unexpected Host header." };
  }
  if (!tokensMatch(headers.get(TOKEN_HEADER), expected.token)) {
    return { ok: false, status: 403, reason: "Missing or wrong access token." };
  }
  return { ok: true };
}

function tokensMatch(given: string | null, expected: string): boolean {
  if (given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
