import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getQuireAccessToken, QuireAuthError, type AuthResult } from "./auth.js";

// Mock the dependencies
vi.mock("./oauth.js", () => ({
  loadOAuthConfigFromEnv: vi.fn(),
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
  buildAuthorizeUrl: vi.fn(),
  generateState: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  QuireOAuthError: class extends Error {
    constructor(
      message: string,
      public code: string
    ) {
      super(message);
    }
  },
}));

vi.mock("./token-store.js", () => ({
  loadTokens: vi.fn(),
  saveTokens: vi.fn(),
}));

// Mock node:http to prevent actual server creation during tests
vi.mock("node:http", () => {
  const mockServer = {
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  };
  return {
    default: {
      createServer: vi.fn(() => mockServer),
    },
  };
});

// Import mocked modules
import {
  loadOAuthConfigFromEnv,
  isTokenExpired,
  refreshAccessToken,
} from "./oauth.js";
import { loadTokens, saveTokens } from "./token-store.js";

describe("QuireAuthError", () => {
  it("should create error with message and code", () => {
    const error = new QuireAuthError("Test error", "NO_CONFIG");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("NO_CONFIG");
    expect(error.name).toBe("QuireAuthError");
  });

  it("should support all error codes", () => {
    const noConfig = new QuireAuthError("No config", "NO_CONFIG");
    const oauthFailed = new QuireAuthError("OAuth failed", "OAUTH_FAILED");
    const userCancelled = new QuireAuthError("Cancelled", "USER_CANCELLED");
    const timeout = new QuireAuthError("Timeout", "TIMEOUT");

    expect(noConfig.code).toBe("NO_CONFIG");
    expect(oauthFailed.code).toBe("OAUTH_FAILED");
    expect(userCancelled.code).toBe("USER_CANCELLED");
    expect(timeout.code).toBe("TIMEOUT");
  });

  it("should be instanceof Error", () => {
    const error = new QuireAuthError("Test", "NO_CONFIG");

    expect(error).toBeInstanceOf(Error);
  });
});

describe("getQuireAccessToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return env token when QUIRE_ACCESS_TOKEN is set", async () => {
    process.env["QUIRE_ACCESS_TOKEN"] = "env-token-123";

    const result = await getQuireAccessToken();

    expect(result.accessToken).toBe("env-token-123");
    expect(result.source).toBe("env");
    // Should not check OAuth config or cached tokens
    expect(loadOAuthConfigFromEnv).not.toHaveBeenCalled();
    expect(loadTokens).not.toHaveBeenCalled();
  });

  it("should throw NO_CONFIG when OAuth not configured and no env token", async () => {
    delete process.env["QUIRE_ACCESS_TOKEN"];
    vi.mocked(loadOAuthConfigFromEnv).mockReturnValue(undefined);

    await expect(getQuireAccessToken()).rejects.toThrow(QuireAuthError);
    await expect(getQuireAccessToken()).rejects.toMatchObject({
      code: "NO_CONFIG",
    });
  });

  it("should return cached token when valid", async () => {
    delete process.env["QUIRE_ACCESS_TOKEN"];
    vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/callback",
    });
    vi.mocked(loadTokens).mockReturnValue({
      accessToken: "cached-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    vi.mocked(isTokenExpired).mockReturnValue(false);

    const result = await getQuireAccessToken();

    expect(result.accessToken).toBe("cached-token");
    expect(result.source).toBe("cache");
  });

  it("should refresh token when cached token is expired", async () => {
    delete process.env["QUIRE_ACCESS_TOKEN"];
    vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/callback",
    });
    vi.mocked(loadTokens).mockReturnValue({
      accessToken: "expired-token",
      refreshToken: "refresh-token",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    vi.mocked(isTokenExpired).mockReturnValue(true);
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: "new-token",
      refreshToken: "new-refresh",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const result = await getQuireAccessToken();

    expect(result.accessToken).toBe("new-token");
    expect(result.source).toBe("refresh");
    expect(saveTokens).toHaveBeenCalled();
  });

  // Note: Testing the full interactive OAuth flow requires mocking node:http
  // and is better suited for integration tests. We verify the refresh attempt path
  // in the "should refresh token when cached token is expired" test above.

  describe("edge cases", () => {
    it("should call loadTokens when no env token", async () => {
      delete process.env["QUIRE_ACCESS_TOKEN"];
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      });
      vi.mocked(loadTokens).mockReturnValue({
        accessToken: "cached",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
      vi.mocked(isTokenExpired).mockReturnValue(false);

      await getQuireAccessToken();

      expect(loadTokens).toHaveBeenCalled();
    });

    it("should try refresh when no accessToken in cache but refreshToken exists", async () => {
      delete process.env["QUIRE_ACCESS_TOKEN"];
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      });
      vi.mocked(loadTokens).mockReturnValue({
        refreshToken: "refresh-only",
        expiresAt: "2099-01-01T00:00:00.000Z",
      } as unknown as ReturnType<typeof loadTokens>);
      vi.mocked(isTokenExpired).mockReturnValue(false);
      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: "refreshed-token",
        refreshToken: "new-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const result = await getQuireAccessToken();

      expect(result.accessToken).toBe("refreshed-token");
      expect(result.source).toBe("refresh");
    });

    it("should call refreshAccessToken when cached token is expired", async () => {
      delete process.env["QUIRE_ACCESS_TOKEN"];
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      });
      vi.mocked(loadTokens).mockReturnValue({
        accessToken: "expired-token",
        refreshToken: "bad-refresh",
        expiresAt: "2020-01-01T00:00:00.000Z",
      });
      vi.mocked(isTokenExpired).mockReturnValue(true);
      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: "new-token",
        refreshToken: "new-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const result = await getQuireAccessToken();

      expect(refreshAccessToken).toHaveBeenCalled();
      expect(result.accessToken).toBe("new-token");
    });

    // Note: Tests that fall through to interactive OAuth require complex HTTP mocking
    // and are better suited for integration tests
  });

  describe("precedence order", () => {
    it("env token takes priority over everything", async () => {
      process.env["QUIRE_ACCESS_TOKEN"] = "env-wins";
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      });
      vi.mocked(loadTokens).mockReturnValue({
        accessToken: "cached-token",
      });

      const result = await getQuireAccessToken();

      expect(result.accessToken).toBe("env-wins");
      expect(result.source).toBe("env");
    });

    it("cache takes priority over refresh when valid", async () => {
      delete process.env["QUIRE_ACCESS_TOKEN"];
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      });
      vi.mocked(loadTokens).mockReturnValue({
        accessToken: "cached-valid",
        refreshToken: "refresh-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
      vi.mocked(isTokenExpired).mockReturnValue(false);

      const result = await getQuireAccessToken();

      expect(result.accessToken).toBe("cached-valid");
      expect(result.source).toBe("cache");
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });
});
