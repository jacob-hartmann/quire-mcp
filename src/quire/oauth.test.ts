import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildAuthorizeUrl,
  isTokenExpired,
  loadOAuthConfigFromEnv,
  generateState,
  exchangeCodeForToken,
  refreshAccessToken,
  QuireOAuthError,
} from "./oauth.js";

describe("OAuth helpers", () => {
  describe("generateState", () => {
    it("should generate a 32-character hex string", () => {
      const state = generateState();
      expect(state).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should generate unique values", () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });
  });

  describe("buildAuthorizeUrl", () => {
    it("should build a valid authorization URL", () => {
      const config = {
        clientId: "test-client-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost:3000/callback",
      };
      const state = "test-state-123";

      const url = buildAuthorizeUrl(config, state);

      expect(url).toContain("https://quire.io/oauth");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback"
      );
      expect(url).toContain("state=test-state-123");
    });
  });

  describe("isTokenExpired", () => {
    it("should return false when no expiration is set", () => {
      expect(isTokenExpired(undefined)).toBe(false);
    });

    it("should return false for future expiration", () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
      expect(isTokenExpired(futureDate)).toBe(false);
    });

    it("should return true for past expiration", () => {
      const pastDate = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it("should return true when within 5-minute buffer", () => {
      const nearFuture = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3 minutes from now
      expect(isTokenExpired(nearFuture)).toBe(true);
    });

    it("should return false when just outside 5-minute buffer", () => {
      const safeFuture = new Date(Date.now() + 6 * 60 * 1000).toISOString(); // 6 minutes from now
      expect(isTokenExpired(safeFuture)).toBe(false);
    });
  });

  describe("loadOAuthConfigFromEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return undefined when client ID is missing", () => {
      delete process.env["QUIRE_OAUTH_CLIENT_ID"];
      process.env["QUIRE_OAUTH_CLIENT_SECRET"] = "secret";

      expect(loadOAuthConfigFromEnv()).toBeUndefined();
    });

    it("should return undefined when client secret is missing", () => {
      process.env["QUIRE_OAUTH_CLIENT_ID"] = "id";
      delete process.env["QUIRE_OAUTH_CLIENT_SECRET"];

      expect(loadOAuthConfigFromEnv()).toBeUndefined();
    });

    it("should return config with default redirect URI", () => {
      process.env["QUIRE_OAUTH_CLIENT_ID"] = "my-id";
      process.env["QUIRE_OAUTH_CLIENT_SECRET"] = "my-secret";
      delete process.env["QUIRE_OAUTH_REDIRECT_URI"];

      const config = loadOAuthConfigFromEnv();

      expect(config).toEqual({
        clientId: "my-id",
        clientSecret: "my-secret",
        redirectUri: "http://localhost:3000/callback",
      });
    });

    it("should respect custom redirect URI", () => {
      process.env["QUIRE_OAUTH_CLIENT_ID"] = "my-id";
      process.env["QUIRE_OAUTH_CLIENT_SECRET"] = "my-secret";
      process.env["QUIRE_OAUTH_REDIRECT_URI"] = "http://localhost:8080/auth";

      const config = loadOAuthConfigFromEnv();

      expect(config?.redirectUri).toBe("http://localhost:8080/auth");
    });
  });

  describe("exchangeCodeForToken", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should exchange code for tokens successfully", async () => {
      const mockResponse = {
        access_token: "access-123",
        refresh_token: "refresh-456",
        expires_in: 2592000,
        token_type: "bearer",
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const config = {
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      };

      const result = await exchangeCodeForToken(config, "auth-code");

      expect(result.accessToken).toBe("access-123");
      expect(result.refreshToken).toBe("refresh-456");
      expect(result.expiresAt).toBeDefined();
    });

    it("should throw on HTTP error", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Invalid code", { status: 400 })
      );

      const config = {
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      };

      await expect(exchangeCodeForToken(config, "bad-code")).rejects.toThrow(
        QuireOAuthError
      );
    });

    it("should throw on invalid JSON", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("not json", { status: 200 })
      );

      const config = {
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      };

      await expect(exchangeCodeForToken(config, "code")).rejects.toThrow(
        QuireOAuthError
      );
    });
  });

  describe("refreshAccessToken", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should refresh token successfully", async () => {
      const mockResponse = {
        access_token: "new-access-123",
        refresh_token: "new-refresh-456",
        expires_in: 2592000,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const config = {
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      };

      const result = await refreshAccessToken(config, "old-refresh-token");

      expect(result.accessToken).toBe("new-access-123");
      expect(result.refreshToken).toBe("new-refresh-456");
    });

    it("should throw REFRESH_FAILED on HTTP error", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Token expired", { status: 401 })
      );

      const config = {
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      };

      await expect(
        refreshAccessToken(config, "expired-refresh")
      ).rejects.toThrow(QuireOAuthError);
    });
  });
});
