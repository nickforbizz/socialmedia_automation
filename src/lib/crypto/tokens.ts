import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Authenticated symmetric encryption for OAuth tokens at rest (AES-256-GCM).
 *
 * The key comes from TOKEN_ENCRYPTION_KEY (32 bytes, base64). Ciphertext format:
 *   base64(iv) . base64(authTag) . base64(ciphertext)
 * GCM's auth tag makes tampering detectable. Tokens are only ever stored/read
 * server-side; the plaintext never leaves the server.
 */
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

function getKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new TokenCryptoError(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (generate: openssl rand -base64 32).",
    );
  }
  return key;
}

export function encryptToken(plaintext: string, keyB64: string): string {
  const key = getKey(keyB64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptToken(payload: string, keyB64: string): string {
  const key = getKey(keyB64);
  const parts = payload.split(".");
  if (parts.length !== 3) throw new TokenCryptoError("Malformed ciphertext.");
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new TokenCryptoError("Decryption failed (wrong key or tampered data).");
  }
}
