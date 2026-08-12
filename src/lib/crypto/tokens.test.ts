import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken, TokenCryptoError } from "./tokens";

const key = randomBytes(32).toString("base64");

describe("token crypto", () => {
  it("round-trips a token", () => {
    const secret = "ya29.a0Af_verylongoauthtoken";
    const enc = encryptToken(secret, key);
    expect(enc).not.toContain(secret);
    expect(decryptToken(enc, key)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("fails to decrypt with the wrong key", () => {
    const enc = encryptToken("secret", key);
    const otherKey = randomBytes(32).toString("base64");
    expect(() => decryptToken(enc, otherKey)).toThrow(TokenCryptoError);
  });

  it("detects tampering via the auth tag", () => {
    const enc = encryptToken("secret", key);
    const [iv, tag, data] = enc.split(".");
    const tampered = `${iv}.${tag}.${Buffer.from("evil").toString("base64")}${data}`;
    expect(() => decryptToken(tampered, key)).toThrow(TokenCryptoError);
  });

  it("rejects a wrong-length key", () => {
    expect(() => encryptToken("x", "c2hvcnQ=")).toThrow(/32 bytes/);
  });
});
