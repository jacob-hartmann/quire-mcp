import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getQuireAccessToken, QuireAuthError } from "./auth.js";
import type { IncomingMessage, ServerResponse } from "node:http";

// Store the request handler to simulate HTTP callbacks
let httpRequestHandler:
  | ((req: IncomingMessage, res: ServerResponse) => void)
  | null = null;

// Mock the dependencies
vi.mock("./oauth.js", () => ({
  loadOAuthConfigFromEnv: vi.fn(),
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
  buildAuthorizeUrl: vi.fn(() => "https://quire.io/oauth/authorize?..."),
  generateState: vi.fn(() => "test-state-123"),
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

// Mock node:http to capture the request handler
vi.mock("node:http", () => {
  const mockServer = {
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  };
  return {
    default: {
      createServer: vi.fn(
        (handler: (req: IncomingMessage, res: ServerResponse) => void) => {
          httpRequestHandler = handler;
          return mockServer;
        }
      ),
    },
  };
});

// Import mocked modules
import {
  loadOAuthConfigFromEnv,
  isTokenExpired,
  refreshAccessToken,
  exchangeCodeForToken,
  generateState,
  buildAuthorizeUrl,
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

  describe("interactive OAuth flow", () => {
    // Helper to simulate callback request
    function simulateCallback(url: string): {
      writeHead: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    } {
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      if (httpRequestHandler) {
        httpRequestHandler(
          { url } as IncomingMessage,
          mockRes as unknown as ServerResponse
        );
      }

      return mockRes;
    }

    beforeEach(() => {
      delete process.env["QUIRE_ACCESS_TOKEN"];
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "test-client",
        clientSecret: "test-secret",
        redirectUri: "http://localhost:3000/callback",
      });
      vi.mocked(loadTokens).mockReturnValue(undefined);
      vi.mocked(generateState).mockReturnValue("expected-state");
      vi.mocked(buildAuthorizeUrl).mockReturnValue(
        "https://quire.io/oauth/authorize?client_id=test"
      );
      httpRequestHandler = null;
    });

    it("should fall through to interactive OAuth when refresh fails", async () => {
      vi.mocked(loadTokens).mockReturnValue({
        accessToken: "expired",
        refreshToken: "bad-refresh",
        expiresAt: "2020-01-01T00:00:00.000Z",
      });
      vi.mocked(isTokenExpired).mockReturnValue(true);
      vi.mocked(refreshAccessToken).mockRejectedValue(
        new Error("Refresh token expired")
      );
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "interactive-token",
        refreshToken: "new-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      // Start the auth flow
      const authPromise = getQuireAccessToken();

      // Wait for server to be created
      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      // Simulate successful callback
      simulateCallback("/callback?code=auth-code&state=expected-state");

      const result = await authPromise;

      expect(result.accessToken).toBe("interactive-token");
      expect(result.source).toBe("interactive");
      expect(exchangeCodeForToken).toHaveBeenCalled();
      expect(saveTokens).toHaveBeenCalled();
    });

    it("should start interactive OAuth when no cached tokens exist", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "fresh-token",
        refreshToken: "fresh-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      simulateCallback("/callback?code=auth-code&state=expected-state");

      const result = await authPromise;

      expect(result.accessToken).toBe("fresh-token");
      expect(result.source).toBe("interactive");
    });

    it("should handle callback with error parameter", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      const mockRes = simulateCallback(
        "/callback?error=access_denied&error_description=User%20denied"
      );

      await expect(authPromise).rejects.toThrow();
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should handle callback with state mismatch", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      const mockRes = simulateCallback(
        "/callback?code=auth-code&state=wrong-state"
      );

      await expect(authPromise).rejects.toThrow();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should handle callback without code", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      const mockRes = simulateCallback("/callback?state=expected-state");

      await expect(authPromise).rejects.toThrow();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should respond with waiting message on non-callback paths", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      // Request to wrong path
      const wrongPathRes = simulateCallback("/favicon.ico");
      expect(wrongPathRes.writeHead).toHaveBeenCalledWith(
        200,
        expect.any(Object)
      );
      expect(wrongPathRes.end).toHaveBeenCalled();

      // Then complete with correct callback
      simulateCallback("/callback?code=auth-code&state=expected-state");

      await authPromise;
    });

    it("should handle server errors gracefully", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);

      // Start auth flow but don't await it - we're just testing server error handling
      void getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      // Simulate request with null URL (edge case)
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      if (httpRequestHandler) {
        httpRequestHandler(
          { url: null } as unknown as IncomingMessage,
          mockRes as unknown as ServerResponse
        );
      }

      // Should handle gracefully
      expect(mockRes.writeHead).toHaveBeenCalled();
    });

    it("should save tokens and complete after successful token exchange", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);
      const expectedTokens = {
        accessToken: "saved-token",
        refreshToken: "saved-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      };
      vi.mocked(exchangeCodeForToken).mockResolvedValue(expectedTokens);

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      simulateCallback("/callback?code=auth-code&state=expected-state");

      const result = await authPromise;

      expect(result.source).toBe("interactive");
      expect(result.accessToken).toBe("saved-token");
      expect(saveTokens).toHaveBeenCalledWith(expectedTokens);
    });

    it("should handle error with description from callback", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      const mockRes = simulateCallback("/callback?error=invalid_scope");

      await expect(authPromise).rejects.toThrow();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should complete flow even with internal exception handling", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      // First request to a non-callback path
      const mockRes1 = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      if (httpRequestHandler) {
        httpRequestHandler(
          { url: "/other" } as IncomingMessage,
          mockRes1 as unknown as ServerResponse
        );
      }

      // Then complete with valid callback
      simulateCallback("/callback?code=auth-code&state=expected-state");

      const result = await authPromise;
      expect(result.accessToken).toBe("token");
    });

    it("should process multiple callback paths correctly", async () => {
      vi.mocked(loadTokens).mockReturnValue(undefined);
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      // First request to wrong path should show waiting message
      const wrongPathRes = simulateCallback("/wrong-path");
      expect(wrongPathRes.writeHead).toHaveBeenCalledWith(
        200,
        expect.any(Object)
      );

      // Complete with valid callback
      simulateCallback("/callback?code=auth-code&state=expected-state");

      const result = await authPromise;
      expect(result.source).toBe("interactive");
    });
  });

  describe("invalid redirect URI handling", () => {
    it("should throw error for redirect URI with invalid port", async () => {
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "test-client",
        clientSecret: "test-secret",
        redirectUri: "http://localhost:invalid/callback",
      });
      vi.mocked(loadTokens).mockReturnValue(undefined);

      await expect(getQuireAccessToken()).rejects.toThrow();
    });

    it("should handle redirect URI with no explicit port (defaults to 80 for http)", async () => {
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "test-client",
        clientSecret: "test-secret",
        redirectUri: "http://localhost/callback",
      });
      vi.mocked(loadTokens).mockReturnValue(undefined);
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      // Simulate successful callback
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      if (httpRequestHandler) {
        httpRequestHandler(
          {
            url: "/callback?code=auth-code&state=expected-state",
          } as IncomingMessage,
          mockRes as unknown as ServerResponse
        );
      }

      const result = await authPromise;
      expect(result.accessToken).toBe("token");
    });

    it("should handle redirect URI with https (defaults to 443)", async () => {
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "test-client",
        clientSecret: "test-secret",
        redirectUri: "https://localhost/callback",
      });
      vi.mocked(loadTokens).mockReturnValue(undefined);
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      if (httpRequestHandler) {
        httpRequestHandler(
          {
            url: "/callback?code=auth-code&state=expected-state",
          } as IncomingMessage,
          mockRes as unknown as ServerResponse
        );
      }

      const result = await authPromise;
      expect(result.accessToken).toBe("token");
    });
  });

  describe("error handling edge cases", () => {
    it("should log and fall through when refresh throws non-Error", async () => {
      delete process.env["QUIRE_ACCESS_TOKEN"];
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/callback",
      });
      vi.mocked(loadTokens).mockReturnValue({
        accessToken: "expired",
        refreshToken: "bad-refresh",
        expiresAt: "2020-01-01T00:00:00.000Z",
      });
      vi.mocked(isTokenExpired).mockReturnValue(true);
      vi.mocked(refreshAccessToken).mockRejectedValue("string error");
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: "interactive-token",
        refreshToken: "new-refresh",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
      httpRequestHandler = null;

      const authPromise = getQuireAccessToken();

      await vi.waitFor(() => {
        expect(httpRequestHandler).not.toBeNull();
      });

      // Simulate successful callback
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      // httpRequestHandler is guaranteed to be non-null after waitFor above
      expect(httpRequestHandler).not.toBeNull();
      // TypeScript can't narrow the type due to the mutable variable, so we assert it's non-null
      httpRequestHandler!(
        {
          url: "/callback?code=auth-code&state=expected-state",
        } as IncomingMessage,
        mockRes as unknown as ServerResponse
      );

      const result = await authPromise;
      expect(result.source).toBe("interactive");
    });
  });

  describe("port validation edge cases", () => {
    it("should throw error for port 0", async () => {
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "test-client",
        clientSecret: "test-secret",
        redirectUri: "http://localhost:0/callback",
      });
      vi.mocked(loadTokens).mockReturnValue(undefined);

      await expect(getQuireAccessToken()).rejects.toThrow("Invalid port");
    });

    it("should throw error for negative port (caught by URL parser)", async () => {
      vi.mocked(loadOAuthConfigFromEnv).mockReturnValue({
        clientId: "test-client",
        clientSecret: "test-secret",
        redirectUri: "http://localhost:-1/callback",
      });
      vi.mocked(loadTokens).mockReturnValue(undefined);

      // URL parser rejects invalid ports before our validation runs
      await expect(getQuireAccessToken()).rejects.toThrow();
    });
  });
});
