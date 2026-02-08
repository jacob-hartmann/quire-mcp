import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Response as ExpressResponse } from "express";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  QuireClientsStore,
  QuireProxyOAuthProvider,
  handleQuireOAuthCallback,
} from "./quire-oauth-provider.js";
import type { HttpServerConfig } from "./config.js";
import { ServerTokenStore } from "./server-token-store.js";

vi.mock("./server-token-store.js", async (importOriginal) => {
  const original = await importOriginal<
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    typeof import("./server-token-store.js")
  >();
  return {
    ...original,
    getServerTokenStore: vi.fn(),
  };
});

vi.mock("../quire/token-store.js", () => ({
  saveTokens: vi.fn(),
}));

import { getServerTokenStore } from "./server-token-store.js";
import { saveTokens } from "../quire/token-store.js";

describe("QuireClientsStore", () => {
  let store: QuireClientsStore;

  beforeEach(() => {
    store = new QuireClientsStore();
  });

  describe("registerClient", () => {
    it("should register a client with generated client_id", () => {
      const metadata = {
        redirect_uris: ["http://localhost/callback"],
        client_name: "Test Client",
      };

      const client = store.registerClient(metadata);

      expect(client.client_id).toBeDefined();
      expect(typeof client.client_id).toBe("string");
      expect(client.client_id_issued_at).toBeDefined();
      expect(client.redirect_uris).toEqual(["http://localhost/callback"]);
      expect(client.client_name).toBe("Test Client");
    });

    it("should generate unique client_ids", () => {
      const client1 = store.registerClient({
        redirect_uris: ["http://localhost/callback1"],
      });
      const client2 = store.registerClient({
        redirect_uris: ["http://localhost/callback2"],
      });

      expect(client1.client_id).not.toBe(client2.client_id);
    });
  });

  describe("getClient", () => {
    it("should return registered client", () => {
      const client = store.registerClient({
        redirect_uris: ["http://localhost/callback"],
      });

      const retrieved = store.getClient(client.client_id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.client_id).toBe(client.client_id);
    });

    it("should return undefined for non-existent client", () => {
      const retrieved = store.getClient("nonexistent");

      expect(retrieved).toBeUndefined();
    });
  });
});

describe("QuireProxyOAuthProvider", () => {
  let provider: QuireProxyOAuthProvider;
  let mockTokenStore: ServerTokenStore;
  let config: HttpServerConfig;

  beforeEach(() => {
    mockTokenStore = new ServerTokenStore();
    vi.mocked(getServerTokenStore).mockReturnValue(mockTokenStore);

    config = {
      host: "127.0.0.1",
      port: 3000,
      issuerUrl: "http://localhost:3000",
      quireClientId: "quire-client-id",
      quireClientSecret: "quire-client-secret",
      quireRedirectUri: "http://localhost:3000/oauth/callback",
    };

    provider = new QuireProxyOAuthProvider(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("clientsStore", () => {
    it("should expose clients store", () => {
      expect(provider.clientsStore).toBeInstanceOf(QuireClientsStore);
    });
  });

  describe("authorize", () => {
    it("should redirect to Quire OAuth with state", async () => {
      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        redirect: vi.fn(),
      } as unknown as ExpressResponse;

      const authorizeFn = provider.authorize.bind(provider);
      await authorizeFn(
        client,
        {
          redirectUri: "http://localhost/callback",
          codeChallenge: "challenge123",
          scopes: ["read", "write"],
          state: "client-state",
        },
        mockRes
      );

      expect(mockRes.redirect).toHaveBeenCalled();
      const redirectCall = (mockRes.redirect as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const redirectUrl = redirectCall?.[0] as string;
      expect(redirectUrl).toContain("https://quire.io/oauth");
      expect(redirectUrl).toContain("client_id=quire-client-id");
      expect(redirectUrl).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback"
      );
      expect(redirectUrl).toContain("state=");
    });

    it("should return error for invalid redirect_uri", async () => {
      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        redirect: vi.fn(),
      } as unknown as ExpressResponse;

      const authorizeFn = provider.authorize.bind(provider);
      await authorizeFn(
        client,
        {
          redirectUri: "http://evil.com/callback",
          codeChallenge: "challenge123",
          state: "client-state",
        },
        mockRes
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "invalid_request",
        error_description: "Invalid redirect_uri",
      });
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });

  describe("challengeForAuthorizationCode", () => {
    it("should return code challenge for valid auth code", async () => {
      const code = mockTokenStore.storeAuthCode({
        clientId: "test-client",
        codeChallenge: "test-challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        quireAccessToken: "quire-token",
        quireRefreshToken: undefined,
        scope: undefined,
      });

      const challengeFn = provider.challengeForAuthorizationCode.bind(provider);
      const challenge = await challengeFn(
        {} as OAuthClientInformationFull,
        code
      );

      expect(challenge).toBe("test-challenge");
    });

    it("should throw for invalid auth code", async () => {
      await expect(
        provider.challengeForAuthorizationCode(
          {} as OAuthClientInformationFull,
          "invalid-code"
        )
      ).rejects.toThrow("Invalid authorization code");
    });
  });

  describe("exchangeAuthorizationCode", () => {
    it("should exchange auth code for tokens", async () => {
      const code = mockTokenStore.storeAuthCode({
        clientId: "test-client",
        codeChallenge: "test-challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        quireAccessToken: "quire-access-token",
        quireRefreshToken: "quire-refresh-token",
        scope: "read write",
      });

      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      const tokens = await provider.exchangeAuthorizationCode(
        client,
        code,
        "verifier",
        "http://localhost/callback"
      );

      expect(tokens.access_token).toBeDefined();
      expect(tokens.token_type).toBe("bearer");
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.scope).toBe("read write");
      expect(tokens.refresh_token).toBeDefined();
    });

    it("should throw for invalid auth code", async () => {
      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      await expect(
        provider.exchangeAuthorizationCode(client, "invalid-code")
      ).rejects.toThrow("Invalid or expired authorization code");
    });

    it("should throw for client mismatch", async () => {
      const code = mockTokenStore.storeAuthCode({
        clientId: "other-client",
        codeChallenge: "test-challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        quireAccessToken: "quire-access-token",
        quireRefreshToken: undefined,
        scope: undefined,
      });

      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      await expect(
        provider.exchangeAuthorizationCode(client, code)
      ).rejects.toThrow("Authorization code was not issued to this client");
    });

    it("should throw for redirect_uri mismatch", async () => {
      const code = mockTokenStore.storeAuthCode({
        clientId: "test-client",
        codeChallenge: "test-challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        quireAccessToken: "quire-access-token",
        quireRefreshToken: undefined,
        scope: undefined,
      });

      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback", "http://localhost/other"],
      };

      await expect(
        provider.exchangeAuthorizationCode(
          client,
          code,
          "verifier",
          "http://localhost/other"
        )
      ).rejects.toThrow("redirect_uri mismatch");
    });

    it("should not issue refresh token if Quire did not provide one", async () => {
      const code = mockTokenStore.storeAuthCode({
        clientId: "test-client",
        codeChallenge: "test-challenge",
        codeChallengeMethod: "S256",
        redirectUri: "http://localhost/callback",
        quireAccessToken: "quire-access-token",
        quireRefreshToken: undefined,
        scope: undefined,
      });

      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      const tokens = await provider.exchangeAuthorizationCode(client, code);

      expect(tokens.refresh_token).toBeUndefined();
    });
  });

  describe("exchangeRefreshToken", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should refresh tokens successfully", async () => {
      const refreshToken = mockTokenStore.storeRefreshToken({
        quireRefreshToken: "quire-refresh",
        clientId: "test-client",
        scope: "read",
      });

      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-quire-access",
            refresh_token: "new-quire-refresh",
            expires_in: 3600,
          }),
      } as Response);

      const tokens = await provider.exchangeRefreshToken(client, refreshToken);

      expect(tokens.access_token).toBeDefined();
      expect(tokens.token_type).toBe("bearer");
      expect(tokens.refresh_token).toBeDefined();
    });

    it("should throw for invalid refresh token", async () => {
      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      await expect(
        provider.exchangeRefreshToken(client, "invalid-token")
      ).rejects.toThrow("Invalid refresh token");
    });

    it("should throw for client mismatch", async () => {
      const refreshToken = mockTokenStore.storeRefreshToken({
        quireRefreshToken: "quire-refresh",
        clientId: "other-client",
        scope: undefined,
      });

      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      await expect(
        provider.exchangeRefreshToken(client, refreshToken)
      ).rejects.toThrow("Refresh token was not issued to this client");
    });

    it("should throw when Quire refresh fails", async () => {
      const refreshToken = mockTokenStore.storeRefreshToken({
        quireRefreshToken: "quire-refresh",
        clientId: "test-client",
        scope: undefined,
      });

      const client: OAuthClientInformationFull = {
        client_id: "test-client",
        client_id_issued_at: Date.now(),
        redirect_uris: ["http://localhost/callback"],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("Invalid refresh token"),
      } as Response);

      await expect(
        provider.exchangeRefreshToken(client, refreshToken)
      ).rejects.toThrow("Quire token refresh failed");
    });
  });

  describe("verifyAccessToken", () => {
    it("should return auth info for valid token", async () => {
      const { accessToken } = mockTokenStore.storeAccessToken({
        quireAccessToken: "quire-token",
        quireRefreshToken: undefined,
        clientId: "test-client",
        scope: "read write",
      });

      const authInfo = await provider.verifyAccessToken(accessToken);

      expect(authInfo.token).toBe(accessToken);
      expect(authInfo.clientId).toBe("test-client");
      expect(authInfo.scopes).toEqual(["read", "write"]);
      expect(authInfo.extra?.["quireToken"]).toBe("quire-token");
    });

    it("should throw for invalid token", async () => {
      await expect(provider.verifyAccessToken("invalid-token")).rejects.toThrow(
        "Invalid or expired token"
      );
    });

    it("should handle empty scope", async () => {
      const { accessToken } = mockTokenStore.storeAccessToken({
        quireAccessToken: "quire-token",
        quireRefreshToken: undefined,
        clientId: "test-client",
        scope: undefined,
      });

      const authInfo = await provider.verifyAccessToken(accessToken);

      expect(authInfo.scopes).toEqual([]);
    });
  });

  describe("revokeToken", () => {
    it("should revoke refresh token with hint", async () => {
      const refreshToken = mockTokenStore.storeRefreshToken({
        quireRefreshToken: "quire-refresh",
        clientId: "test-client",
        scope: undefined,
      });

      await provider.revokeToken({} as OAuthClientInformationFull, {
        token: refreshToken,
        token_type_hint: "refresh_token",
      });

      expect(mockTokenStore.getRefreshToken(refreshToken)).toBeUndefined();
    });

    it("should revoke access token without hint", async () => {
      const { accessToken } = mockTokenStore.storeAccessToken({
        quireAccessToken: "quire-token",
        quireRefreshToken: undefined,
        clientId: "test-client",
        scope: undefined,
      });

      await provider.revokeToken({} as OAuthClientInformationFull, {
        token: accessToken,
      });

      expect(mockTokenStore.getAccessToken(accessToken)).toBeUndefined();
    });

    it("should try both token types without hint", async () => {
      const refreshToken = mockTokenStore.storeRefreshToken({
        quireRefreshToken: "quire-refresh",
        clientId: "test-client",
        scope: undefined,
      });

      // Even though it's a refresh token, without hint it should try both
      await provider.revokeToken({} as OAuthClientInformationFull, {
        token: refreshToken,
      });

      expect(mockTokenStore.getRefreshToken(refreshToken)).toBeUndefined();
    });
  });
});

describe("handleQuireOAuthCallback", () => {
  let tokenStore: ServerTokenStore;
  let config: HttpServerConfig;

  beforeEach(() => {
    tokenStore = new ServerTokenStore();
    config = {
      host: "127.0.0.1",
      port: 3000,
      issuerUrl: "http://localhost:3000",
      quireClientId: "quire-client-id",
      quireClientSecret: "quire-client-secret",
      quireRedirectUri: "http://localhost:3000/oauth/callback",
    };

    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return error for invalid state", async () => {
    const result = await handleQuireOAuthCallback(
      config,
      tokenStore,
      "auth-code",
      "invalid-state"
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("invalid_request");
      expect(result.errorDescription).toContain("Invalid or expired state");
    }
  });

  it("should exchange code and return redirect URL", async () => {
    const state = tokenStore.storePendingRequest({
      clientId: "test-client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      redirectUri: "http://localhost:8080/callback",
      clientState: "client-state",
      scope: "read",
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "quire-access",
          refresh_token: "quire-refresh",
        }),
    } as Response);

    const result = await handleQuireOAuthCallback(
      config,
      tokenStore,
      "quire-auth-code",
      state
    );

    expect("redirectUrl" in result).toBe(true);
    if ("redirectUrl" in result) {
      expect(result.redirectUrl).toContain("http://localhost:8080/callback");
      expect(result.redirectUrl).toContain("code=");
      expect(result.redirectUrl).toContain("state=client-state");
    }
  });

  it("should return error when Quire token exchange fails", async () => {
    const state = tokenStore.storePendingRequest({
      clientId: "test-client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      redirectUri: "http://localhost:8080/callback",
      clientState: "client-state",
      scope: undefined,
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("Invalid code"),
    } as Response);

    const result = await handleQuireOAuthCallback(
      config,
      tokenStore,
      "invalid-code",
      state
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("server_error");
      expect(result.errorDescription).toContain(
        "Failed to exchange authorization code"
      );
    }
  });

  it("should return error on network failure", async () => {
    const state = tokenStore.storePendingRequest({
      clientId: "test-client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      redirectUri: "http://localhost:8080/callback",
      clientState: "client-state",
      scope: undefined,
    });

    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await handleQuireOAuthCallback(
      config,
      tokenStore,
      "auth-code",
      state
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("server_error");
      expect(result.errorDescription).toContain(
        "Failed to communicate with Quire"
      );
    }
  });

  it("should succeed when saveTokens throws during callback", async () => {
    const state = tokenStore.storePendingRequest({
      clientId: "test-client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      redirectUri: "http://localhost:8080/callback",
      clientState: "client-state",
      scope: "read",
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "quire-access",
          refresh_token: "quire-refresh",
        }),
    } as Response);

    vi.mocked(saveTokens).mockImplementation(() => {
      throw new Error("Disk write failed");
    });

    const result = await handleQuireOAuthCallback(
      config,
      tokenStore,
      "quire-auth-code",
      state
    );

    // Should succeed despite saveTokens throwing
    expect("redirectUrl" in result).toBe(true);
  });

  it("should persist tokens with expiresAt when expires_in is present", async () => {
    const state = tokenStore.storePendingRequest({
      clientId: "test-client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      redirectUri: "http://localhost:8080/callback",
      clientState: "client-state",
      scope: "read",
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "quire-access",
          refresh_token: "quire-refresh",
          expires_in: 3600,
        }),
    } as Response);

    vi.mocked(saveTokens).mockImplementation(() => {
      // no-op
    });

    await handleQuireOAuthCallback(
      config,
      tokenStore,
      "quire-auth-code",
      state
    );

    expect(saveTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "quire-access",
        refreshToken: "quire-refresh",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresAt: expect.any(String),
      })
    );
  });

  it("should fall back to quireState when clientState is empty", async () => {
    const state = tokenStore.storePendingRequest({
      clientId: "test-client",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      redirectUri: "http://localhost:8080/callback",
      scope: "read",
      // No clientState
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "quire-access",
        }),
    } as Response);

    const result = await handleQuireOAuthCallback(
      config,
      tokenStore,
      "quire-auth-code",
      state
    );

    expect("redirectUrl" in result).toBe(true);
    if ("redirectUrl" in result) {
      // State should be the quireState (the state param we passed in)
      expect(result.redirectUrl).toContain(
        `state=${encodeURIComponent(state)}`
      );
    }
  });
});

describe("exchangeRefreshToken edge cases", () => {
  let provider: QuireProxyOAuthProvider;
  let mockTokenStore: ServerTokenStore;
  let config: HttpServerConfig;

  beforeEach(() => {
    mockTokenStore = new ServerTokenStore();
    vi.mocked(getServerTokenStore).mockReturnValue(mockTokenStore);

    config = {
      host: "127.0.0.1",
      port: 3000,
      issuerUrl: "http://localhost:3000",
      quireClientId: "quire-client-id",
      quireClientSecret: "quire-client-secret",
      quireRedirectUri: "http://localhost:3000/oauth/callback",
    };

    provider = new QuireProxyOAuthProvider(config);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should succeed when saveTokens throws during refresh", async () => {
    const refreshToken = mockTokenStore.storeRefreshToken({
      quireRefreshToken: "quire-refresh",
      clientId: "test-client",
      scope: "read",
    });

    const client: OAuthClientInformationFull = {
      client_id: "test-client",
      client_id_issued_at: Date.now(),
      redirect_uris: ["http://localhost/callback"],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-quire-access",
          refresh_token: "new-quire-refresh",
          expires_in: 3600,
        }),
    } as Response);

    vi.mocked(saveTokens).mockImplementation(() => {
      throw new Error("Disk write failed");
    });

    const tokens = await provider.exchangeRefreshToken(client, refreshToken);

    // Should succeed despite saveTokens error
    expect(tokens.access_token).toBeDefined();
    expect(tokens.token_type).toBe("bearer");
  });

  it("should not issue new refresh token when Quire omits refresh_token", async () => {
    const refreshToken = mockTokenStore.storeRefreshToken({
      quireRefreshToken: "quire-refresh",
      clientId: "test-client",
      scope: "read",
    });

    const client: OAuthClientInformationFull = {
      client_id: "test-client",
      client_id_issued_at: Date.now(),
      redirect_uris: ["http://localhost/callback"],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-quire-access",
          // No refresh_token
        }),
    } as Response);

    const tokens = await provider.exchangeRefreshToken(client, refreshToken);

    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeUndefined();
  });
});
