import type { IncomingMessage } from "node:http";

/**
 * Validates stream WebSocket upgrade requests when STREAM_TOKEN is configured.
 * Accepts `?token=` query param or `Authorization: Bearer <token>`.
 */
export function validateStreamToken(
  req: IncomingMessage,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) return true;

  const url = req.url ?? "";
  const queryIndex = url.indexOf("?");
  if (queryIndex >= 0) {
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    const q = params.get("token");
    if (q && timingSafeEqual(q, expectedToken)) return true;
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (timingSafeEqual(token, expectedToken)) return true;
  }

  return false;
}

export function appendTokenQuery(url: string, token: string | undefined): string {
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
