import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { createState, verifyState } from "./oauth-state";

const secret = randomBytes(32).toString("base64");
const projectId = "11111111-1111-1111-1111-111111111111";

describe("oauth state (CSRF)", () => {
  it("round-trips platform + projectId and generates a nonce", () => {
    const token = createState("linkedin", projectId, secret);
    const state = verifyState(token, secret);
    expect(state).not.toBeNull();
    expect(state?.platform).toBe("linkedin");
    expect(state?.projectId).toBe(projectId);
    expect(state?.nonce).toHaveLength(32);
  });

  it("produces a unique state each call (fresh nonce)", () => {
    expect(createState("x", projectId, secret)).not.toBe(createState("x", projectId, secret));
  });

  it("rejects a tampered signature", () => {
    const token = createState("facebook", projectId, secret);
    const [payload] = token.split(".");
    const forged = `${payload}.${Buffer.from("forged-sig").toString("base64url")}`;
    expect(verifyState(forged, secret)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createState("facebook", projectId, secret);
    const [, sig] = token.split(".");
    const evilPayload = Buffer.from(`instagram:${projectId}:deadbeef`).toString("base64url");
    expect(verifyState(`${evilPayload}.${sig}`, secret)).toBeNull();
  });

  it("rejects a state signed with a different secret", () => {
    const token = createState("youtube", projectId, secret);
    const otherSecret = randomBytes(32).toString("base64");
    expect(verifyState(token, otherSecret)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyState("not-a-token", secret)).toBeNull();
    expect(verifyState("", secret)).toBeNull();
    expect(verifyState("a.b.c", secret)).toBeNull();
  });
});
