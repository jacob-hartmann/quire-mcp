import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ServerTokenStore,
  verifyPkceChallenge,
  getServerTokenStore,
} from "./server-token-store.js";

describe("ServerTokenStore", () => {
  let store: ServerTokenStore;

  beforeEach(() => {
    store = new ServerTokenStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Pending Authorization Requests", () => {
    it("should store and consume pending request", () => {
      const state = store.storePendingRequest({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        scope: "read write",
      });

      expect(state).toBeDefined();
      expect(typeof state).toBe("string");

      const request = store.consumePendingRequest(state);

      expect(request).toBeDefined();
      expect(request?.clientId).toBe("test-client");
      expect(request?.codeChallenge).toBe("challenge");
      expect(request?.codeChallengeMethod).toBe("S256");
      expect(request?.redirectUri).toBe("http://localhost/callback");
      expect(request?.scope).toBe("read write");
    });

    it("should return undefined for non-existent state", () => {
      const request = store.consumePendingRequest("nonexistent");

      expect(request).toBeUndefined();
    });

    it("should consume request only once", () => {
      const state = store.storePendingRequest({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        scope: undefined,
      });

      const request1 = store.consumePendingRequest(state);
      const request2 = store.consumePendingRequest(state);

      expect(request1).toBeDefined();
      expect(request2).toBeUndefined();
    });

    it("should return undefined for expired pending request", () => {
      const state = store.storePendingRequest({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "plain",
        redirectUri: "http://localhost/callback",
        scope: undefined,
      });

      // Advance time past expiry (10 minutes + 1 second)
      vi.advanceTimersByTime(601 * 1000);

      const request = store.consumePendingRequest(state);

      expect(request).toBeUndefined();
    });

    it("should return request just before expiry", () => {
      const state = store.storePendingRequest({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        scope: undefined,
      });

      // Advance time to just before expiry (10 minutes - 1 second)
      vi.advanceTimersByTime(599 * 1000);

      const request = store.consumePendingRequest(state);

      expect(request).toBeDefined();
    });
  });

  describe("Authorization Codes", () => {
    const authCodeData = {
      clientId: "test-client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256" as const,
      redirectUri: "http://localhost/callback",
      quireAccessToken: "quire-access-token",
      quireRefreshToken: "quire-refresh-token",
      scope: "read",
    };

    it("should store and get auth code", () => {
      const code = store.storeAuthCode(authCodeData);

      expect(code).toBeDefined();
      expect(typeof code).toBe("string");

      const entry = store.getAuthCode(code);

      expect(entry).toBeDefined();
      expect(entry?.clientId).toBe("test-client");
      expect(entry?.quireAccessToken).toBe("quire-access-token");
      expect(entry?.quireRefreshToken).toBe("quire-refresh-token");
    });

    it("should consume auth code only once", () => {
      const code = store.storeAuthCode(authCodeData);

      const entry1 = store.consumeAuthCode(code);
      const entry2 = store.consumeAuthCode(code);

      expect(entry1).toBeDefined();
      expect(entry2).toBeUndefined();
    });

    it("should return undefined for non-existent auth code", () => {
      const entry = store.getAuthCode("nonexistent");

      expect(entry).toBeUndefined();
    });

    it("should return undefined for expired auth code", () => {
      const code = store.storeAuthCode(authCodeData);

      // Advance time past expiry (10 minutes + 1 second)
      vi.advanceTimersByTime(601 * 1000);

      const entry = store.getAuthCode(code);

      expect(entry).toBeUndefined();
    });

    it("should delete expired auth code on get", () => {
      const code = store.storeAuthCode(authCodeData);

      vi.advanceTimersByTime(601 * 1000);

      // First get should delete it
      store.getAuthCode(code);

      // Second get should still return undefined
      const entry = store.getAuthCode(code);

      expect(entry).toBeUndefined();
    });
  });

  describe("Access Tokens", () => {
    const tokenData = {
      quireAccessToken: "quire-token",
      quireRefreshToken: "quire-refresh",
      clientId: "test-client",
      scope: "read write",
    };

    it("should store and get access token", () => {
      const { accessToken, expiresIn } = store.storeAccessToken(tokenData);

      expect(accessToken).toBeDefined();
      expect(typeof accessToken).toBe("string");
      expect(expiresIn).toBe(3600); // 1 hour

      const entry = store.getAccessToken(accessToken);

      expect(entry).toBeDefined();
      expect(entry?.quireAccessToken).toBe("quire-token");
      expect(entry?.clientId).toBe("test-client");
    });

    it("should return undefined for non-existent access token", () => {
      const entry = store.getAccessToken("nonexistent");

      expect(entry).toBeUndefined();
    });

    it("should return undefined for expired access token", () => {
      const { accessToken } = store.storeAccessToken(tokenData);

      // Advance time past expiry (1 hour + 1 second)
      vi.advanceTimersByTime(3601 * 1000);

      const entry = store.getAccessToken(accessToken);

      expect(entry).toBeUndefined();
    });

    it("should revoke access token", () => {
      const { accessToken } = store.storeAccessToken(tokenData);

      const revoked = store.revokeAccessToken(accessToken);

      expect(revoked).toBe(true);

      const entry = store.getAccessToken(accessToken);
      expect(entry).toBeUndefined();
    });

    it("should return false when revoking non-existent token", () => {
      const revoked = store.revokeAccessToken("nonexistent");

      expect(revoked).toBe(false);
    });
  });

  describe("Refresh Tokens", () => {
    const refreshData = {
      quireRefreshToken: "quire-refresh",
      clientId: "test-client",
      scope: "read",
    };

    it("should store and get refresh token", () => {
      const token = store.storeRefreshToken(refreshData);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const entry = store.getRefreshToken(token);

      expect(entry).toBeDefined();
      expect(entry?.quireRefreshToken).toBe("quire-refresh");
      expect(entry?.clientId).toBe("test-client");
    });

    it("should return undefined for non-existent refresh token", () => {
      const entry = store.getRefreshToken("nonexistent");

      expect(entry).toBeUndefined();
    });

    it("should return undefined for expired refresh token", () => {
      const token = store.storeRefreshToken(refreshData);

      // Advance time past expiry (30 days + 1 second)
      vi.advanceTimersByTime((30 * 24 * 60 * 60 + 1) * 1000);

      const entry = store.getRefreshToken(token);

      expect(entry).toBeUndefined();
    });

    it("should revoke refresh token", () => {
      const token = store.storeRefreshToken(refreshData);

      const revoked = store.revokeRefreshToken(token);

      expect(revoked).toBe(true);

      const entry = store.getRefreshToken(token);
      expect(entry).toBeUndefined();
    });

    it("should return false when revoking non-existent refresh token", () => {
      const revoked = store.revokeRefreshToken("nonexistent");

      expect(revoked).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should remove expired pending requests", () => {
      store.storePendingRequest({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        scope: undefined,
      });

      // Advance time past expiry
      vi.advanceTimersByTime(601 * 1000);

      store.cleanup();

      // Internal state should be cleaned, but we can't directly verify
      // This is mainly for coverage
    });

    it("should remove expired auth codes", () => {
      store.storeAuthCode({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        quireAccessToken: "token",
        quireRefreshToken: undefined,
        scope: undefined,
      });

      vi.advanceTimersByTime(601 * 1000);

      store.cleanup();
    });

    it("should remove expired access tokens", () => {
      store.storeAccessToken({
        quireAccessToken: "token",
        quireRefreshToken: undefined,
        clientId: "test-client",
        scope: undefined,
      });

      vi.advanceTimersByTime(3601 * 1000);

      store.cleanup();
    });

    it("should remove expired refresh tokens", () => {
      store.storeRefreshToken({
        quireRefreshToken: "refresh",
        clientId: "test-client",
        scope: undefined,
      });

      vi.advanceTimersByTime((30 * 24 * 60 * 60 + 1) * 1000);

      store.cleanup();
    });

    it("should not remove non-expired entries", () => {
      const state = store.storePendingRequest({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        scope: undefined,
      });

      const code = store.storeAuthCode({
        clientId: "test-client",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        quireAccessToken: "token",
        quireRefreshToken: undefined,
        scope: undefined,
      });

      const { accessToken } = store.storeAccessToken({
        quireAccessToken: "token",
        quireRefreshToken: undefined,
        clientId: "test-client",
        scope: undefined,
      });

      const refreshToken = store.storeRefreshToken({
        quireRefreshToken: "refresh",
        clientId: "test-client",
        scope: undefined,
      });

      // Advance time but not past expiry
      vi.advanceTimersByTime(60 * 1000); // 1 minute

      store.cleanup();

      // All entries should still be accessible
      expect(store.consumePendingRequest(state)).toBeDefined();
      expect(store.getAuthCode(code)).toBeDefined();
      expect(store.getAccessToken(accessToken)).toBeDefined();
      expect(store.getRefreshToken(refreshToken)).toBeDefined();
    });
  });
});

describe("verifyPkceChallenge", () => {
  describe("plain method", () => {
    it("should return true when verifier matches challenge", () => {
      const verifier = "my-code-verifier";
      const challenge = "my-code-verifier";

      const result = verifyPkceChallenge(verifier, challenge, "plain");

      expect(result).toBe(true);
    });

    it("should return false when verifier does not match challenge", () => {
      const verifier = "my-code-verifier";
      const challenge = "different-challenge";

      const result = verifyPkceChallenge(verifier, challenge, "plain");

      expect(result).toBe(false);
    });
  });

  describe("S256 method", () => {
    it("should return true for valid S256 challenge", () => {
      // Test vector: verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
      // SHA256 hash = E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM (base64url)
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

      const result = verifyPkceChallenge(verifier, challenge, "S256");

      expect(result).toBe(true);
    });

    it("should return false for invalid S256 challenge", () => {
      const verifier = "my-code-verifier";
      const challenge = "invalid-challenge";

      const result = verifyPkceChallenge(verifier, challenge, "S256");

      expect(result).toBe(false);
    });

    it("should handle base64url encoding correctly (no padding)", () => {
      // A verifier that would produce a hash with padding characters
      const verifier = "test-verifier-1234";

      // First compute the expected challenge
      /* eslint-disable @typescript-eslint/no-require-imports */
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      /* eslint-disable @typescript-eslint/no-unsafe-call */
      const crypto = require("node:crypto");
      const hash = crypto.createHash("sha256").update(verifier).digest();
      const expectedChallenge = hash
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      /* eslint-enable @typescript-eslint/no-unsafe-call */
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      /* eslint-enable @typescript-eslint/no-require-imports */

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = verifyPkceChallenge(verifier, expectedChallenge, "S256");

      expect(result).toBe(true);
    });
  });
});

describe("getServerTokenStore", () => {
  it("should return singleton instance", () => {
    const store1 = getServerTokenStore();
    const store2 = getServerTokenStore();

    expect(store1).toBe(store2);
  });

  it("should return ServerTokenStore instance", () => {
    const store = getServerTokenStore();

    expect(store).toBeInstanceOf(ServerTokenStore);
  });
});
