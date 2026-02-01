/**
 * Quire Proxy OAuth Provider
 *
 * Implements OAuthServerProvider to proxy OAuth requests to Quire.
 * This allows MCP clients to use PKCE (which Quire doesn't support)
 * while we handle the non-PKCE flow with Quire behind the scenes.
 *
 * Flow:
 * 1. MCP client starts OAuth with PKCE code_challenge
 * 2. We store the PKCE params and redirect to Quire OAuth (no PKCE)
 * 3. User authorizes at Quire, Quire redirects back to our callback
 * 4. Our callback exchanges Quire code for Quire tokens
 * 5. We generate our own auth code and store mapping to Quire tokens
 * 6. We redirect MCP client with our auth code
 * 7. MCP client exchanges our code + code_verifier at our token endpoint
 * 8. We validate PKCE, issue our token wrapping the Quire token
 */

import type { Response as ExpressResponse } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import type { HttpServerConfig } from "./config.js";
import {
  getServerTokenStore,
  type ServerTokenStore,
} from "./server-token-store.js";
import {
  QUIRE_OAUTH_AUTHORIZE_URL,
  QUIRE_OAUTH_TOKEN_URL,
  FETCH_TIMEOUT_MS,
} from "../constants.js";

// ---------------------------------------------------------------------------
// Clients Store
// ---------------------------------------------------------------------------

/**
 * In-memory store for registered OAuth clients.
 * Supports dynamic client registration per RFC 7591.
 */
export class QuireClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const client = this.clients.get(clientId);
    console.error(
      `[quire-mcp] getClient(${clientId}): ${client ? "found" : "NOT FOUND"}`
    );
    return client;
  }

  registerClient(
    clientMetadata: Omit<
      OAuthClientInformationFull,
      "client_id" | "client_id_issued_at"
    >
  ): OAuthClientInformationFull {
    const client: OAuthClientInformationFull = {
      ...clientMetadata,
      client_id: crypto.randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(client.client_id, client);
    console.error(
      `[quire-mcp] registerClient: new client_id=${client.client_id}`
    );
    return client;
  }
}

// ---------------------------------------------------------------------------
// Quire Proxy OAuth Provider
// ---------------------------------------------------------------------------

/**
 * OAuth provider that proxies authorization to Quire.
 * Implements PKCE locally while Quire uses simple OAuth.
 */
export class QuireProxyOAuthProvider implements OAuthServerProvider {
  private readonly config: HttpServerConfig;
  private readonly tokenStore: ServerTokenStore;
  readonly clientsStore: QuireClientsStore;

  constructor(config: HttpServerConfig) {
    this.config = config;
    this.tokenStore = getServerTokenStore();
    this.clientsStore = new QuireClientsStore();
  }

  /**
   * Begin authorization by storing PKCE params and redirecting to Quire.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: ExpressResponse
  ): Promise<void> {
    // Validate redirect_uri
    if (!client.redirect_uris.includes(params.redirectUri)) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "Invalid redirect_uri",
      });
      return;
    }

    // Store pending request with PKCE params
    const state = this.tokenStore.storePendingRequest({
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: "S256", // We only support S256
      redirectUri: params.redirectUri,
      scope: params.scopes?.join(" "),
    });

    // Build Quire OAuth URL (no PKCE)
    const quireAuthUrl = new URL(QUIRE_OAUTH_AUTHORIZE_URL);
    quireAuthUrl.searchParams.set("response_type", "code");
    quireAuthUrl.searchParams.set("client_id", this.config.quireClientId);
    quireAuthUrl.searchParams.set("redirect_uri", this.config.quireRedirectUri);
    quireAuthUrl.searchParams.set("state", state);

    res.redirect(quireAuthUrl.toString());
  }

  /**
   * Return the stored code_challenge for PKCE validation.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const entry = this.tokenStore.getAuthCode(authorizationCode);
    if (!entry) {
      throw new Error("Invalid authorization code");
    }
    return entry.codeChallenge;
  }

  /**
   * Exchange authorization code for tokens.
   * Validates PKCE locally, then returns our token wrapping Quire token.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    // Get and consume the auth code
    const codeEntry = this.tokenStore.consumeAuthCode(authorizationCode);
    if (!codeEntry) {
      throw new Error("Invalid or expired authorization code");
    }

    // Verify client matches
    if (codeEntry.clientId !== client.client_id) {
      throw new Error("Authorization code was not issued to this client");
    }

    // Verify redirect_uri matches
    if (redirectUri && codeEntry.redirectUri !== redirectUri) {
      throw new Error("redirect_uri mismatch");
    }

    // Note: PKCE validation is handled by the SDK via challengeForAuthorizationCode()
    // The SDK validates code_verifier before calling this method

    // Issue our access token wrapping the Quire token
    const { accessToken, expiresIn } = this.tokenStore.storeAccessToken({
      quireAccessToken: codeEntry.quireAccessToken,
      quireRefreshToken: codeEntry.quireRefreshToken,
      clientId: client.client_id,
      scope: codeEntry.scope,
    });

    // Issue refresh token if Quire gave us one
    let refreshToken: string | undefined;
    if (codeEntry.quireRefreshToken) {
      refreshToken = this.tokenStore.storeRefreshToken({
        quireRefreshToken: codeEntry.quireRefreshToken,
        clientId: client.client_id,
        scope: codeEntry.scope,
      });
    }

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      scope: codeEntry.scope,
      refresh_token: refreshToken,
    };
  }

  /**
   * Exchange refresh token for new access token.
   */
  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    _scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    // Get refresh token entry
    const refreshEntry = this.tokenStore.getRefreshToken(refreshToken);
    if (!refreshEntry) {
      throw new Error("Invalid refresh token");
    }

    // Verify client matches
    if (refreshEntry.clientId !== client.client_id) {
      throw new Error("Refresh token was not issued to this client");
    }

    // Refresh the Quire token
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshEntry.quireRefreshToken,
      client_id: this.config.quireClientId,
      client_secret: this.config.quireClientSecret,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(QUIRE_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Quire token refresh failed: ${text.slice(0, 200)}`);
    }

    const quireTokens = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // Revoke old refresh token and issue new ones
    this.tokenStore.revokeRefreshToken(refreshToken);

    const { accessToken, expiresIn } = this.tokenStore.storeAccessToken({
      quireAccessToken: quireTokens.access_token,
      quireRefreshToken: quireTokens.refresh_token,
      clientId: client.client_id,
      scope: refreshEntry.scope,
    });

    let newRefreshToken: string | undefined;
    if (quireTokens.refresh_token) {
      newRefreshToken = this.tokenStore.storeRefreshToken({
        quireRefreshToken: quireTokens.refresh_token,
        clientId: client.client_id,
        scope: refreshEntry.scope,
      });
    }

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      scope: refreshEntry.scope,
      refresh_token: newRefreshToken,
    };
  }

  /**
   * Verify an access token and return auth info.
   * The Quire token is stored in extra.quireToken for use by handlers.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const entry = this.tokenStore.getAccessToken(token);
    if (!entry) {
      throw new Error("Invalid or expired token");
    }

    return {
      token,
      clientId: entry.clientId,
      scopes: entry.scope ? entry.scope.split(" ") : [],
      expiresAt: Math.floor(entry.expiresAt / 1000),
      extra: {
        quireToken: entry.quireAccessToken,
      },
    };
  }

  /**
   * Revoke an access or refresh token.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    const { token, token_type_hint } = request;

    if (token_type_hint === "refresh_token") {
      this.tokenStore.revokeRefreshToken(token);
    } else {
      // Try both - token could be either type
      this.tokenStore.revokeAccessToken(token);
      this.tokenStore.revokeRefreshToken(token);
    }
  }
}

// ---------------------------------------------------------------------------
// Quire OAuth Callback Handler
// ---------------------------------------------------------------------------

/**
 * Handle the OAuth callback from Quire.
 * Exchanges Quire auth code for tokens, then redirects to MCP client.
 */
export async function handleQuireOAuthCallback(
  config: HttpServerConfig,
  tokenStore: ServerTokenStore,
  code: string,
  state: string
): Promise<
  { redirectUrl: string } | { error: string; errorDescription: string }
> {
  // Get pending request
  const pending = tokenStore.consumePendingRequest(state);
  if (!pending) {
    return {
      error: "invalid_request",
      errorDescription: "Invalid or expired state parameter",
    };
  }

  // Exchange Quire code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.quireClientId,
    client_secret: config.quireClientSecret,
  });

  let quireTokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(QUIRE_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      // Truncate error details to avoid leaking sensitive data in logs
      console.error(
        `[quire-mcp] Quire token exchange failed: ${text.slice(0, 200)}`
      );
      return {
        error: "server_error",
        errorDescription: "Failed to exchange authorization code with Quire",
      };
    }

    quireTokens = (await response.json()) as typeof quireTokens;
  } catch (err) {
    console.error("[quire-mcp] Quire token exchange error:", err);
    return {
      error: "server_error",
      errorDescription: "Failed to communicate with Quire",
    };
  }

  // Generate our authorization code
  const ourCode = tokenStore.storeAuthCode({
    clientId: pending.clientId,
    codeChallenge: pending.codeChallenge,
    codeChallengeMethod: pending.codeChallengeMethod,
    redirectUri: pending.redirectUri,
    quireAccessToken: quireTokens.access_token,
    quireRefreshToken: quireTokens.refresh_token,
    scope: pending.scope,
  });

  // Build redirect URL back to MCP client
  const redirectUrl = new URL(pending.redirectUri);
  redirectUrl.searchParams.set("code", ourCode);
  redirectUrl.searchParams.set("state", state);

  return { redirectUrl: redirectUrl.toString() };
}
