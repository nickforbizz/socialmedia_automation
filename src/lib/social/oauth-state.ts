import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Stateless, tamper-proof OAuth `state` for CSRF protection.
 * Encodes platform + projectId + nonce and signs them with an HMAC derived from
 * the token-encryption key. The same value is also stored in an httpOnly cookie;
 * the callback requires both to match.
 */
export interface OAuthState {
  platform: string;
  projectId: string;
  nonce: string;
}

export function createState(platform: string, projectId: string, secret: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${platform}:${projectId}:${nonce}`;
  const sig = sign(payload, secret);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(token: string, secret: string): OAuthState | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts as [string, string];
  const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  const expected = sign(payload, secret);
  if (!safeEqual(sig, expected)) return null;

  const segments = payload.split(":");
  if (segments.length !== 3) return null;
  const [platform, projectId, nonce] = segments as [string, string, string];
  return { platform, projectId, nonce };
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
