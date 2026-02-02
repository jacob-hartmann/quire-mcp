/**
 * Quire Authentication
 *
 * Resolves an access token using the following precedence:
 *   1. QUIRE_ACCESS_TOKEN environment variable (manual override)
 *   2. Cached token from disk (if not expired)
 *   3. Refresh using stored refresh_token
 *   4. Interactive OAuth login via local callback server
 *
 * All logging goes to stderr to avoid corrupting MCP's JSON-RPC over stdout.
 */

import http from "node:http";
import { URL } from "node:url";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  generateState,
  isTokenExpired,
  loadOAuthConfigFromEnv,
  QuireOAuthError,
  refreshAccessToken,
  type QuireOAuthConfig,
  type QuireTokenData,
} from "./oauth.js";
import { loadTokens, saveTokens } from "./token-store.js";
import { escapeHtml } from "../utils/html.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthResult {
  accessToken: string;
  /** Where the token came from */
  source: "env" | "cache" | "refresh" | "interactive";
}

export class QuireAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NO_CONFIG"
      | "OAUTH_FAILED"
      | "USER_CANCELLED"
      | "TIMEOUT"
  ) {
    super(message);
    this.name = "QuireAuthError";
  }
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Get a valid Quire access token using the precedence chain.
 * May trigger interactive OAuth if no valid token is available.
 */
export async function getQuireAccessToken(): Promise<AuthResult> {
  // 1. Check for explicit env override
  const envToken = process.env["QUIRE_ACCESS_TOKEN"];
  if (envToken) {
    return { accessToken: envToken, source: "env" };
  }

  // 2. Check for OAuth config (required for all other paths)
  const config = loadOAuthConfigFromEnv();
  if (!config) {
    throw new QuireAuthError(
      "No QUIRE_ACCESS_TOKEN set and QUIRE_OAUTH_CLIENT_ID/QUIRE_OAUTH_CLIENT_SECRET not configured. " +
        "Please set either QUIRE_ACCESS_TOKEN or the OAuth environment variables.",
      "NO_CONFIG"
    );
  }

  // 3. Try cached token
  const cached = loadTokens();
  if (cached?.accessToken && !isTokenExpired(cached.expiresAt)) {
    return { accessToken: cached.accessToken, source: "cache" };
  }

  // 4. Try refresh
  if (cached?.refreshToken) {
    try {
      console.error("[quire-mcp] Refreshing access token...");
      const refreshed = await refreshAccessToken(config, cached.refreshToken);
      saveTokens(refreshed);
      return { accessToken: refreshed.accessToken, source: "refresh" };
    } catch (err) {
      // Refresh failed — fall through to interactive login
      console.error(
        "[quire-mcp] Token refresh failed, will require interactive login:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // 5. Interactive OAuth
  console.error("[quire-mcp] Starting interactive OAuth login...");
  const tokens = await runInteractiveOAuth(config);
  saveTokens(tokens);
  return { accessToken: tokens.accessToken, source: "interactive" };
}

// ---------------------------------------------------------------------------
// Interactive OAuth Flow
// ---------------------------------------------------------------------------

/**
 * Run the interactive OAuth flow:
 *   - Start a local HTTP server for the callback
 *   - Print the authorization URL to stderr
 *   - Wait for the callback with the authorization code
 *   - Exchange the code for tokens
 */
async function runInteractiveOAuth(
  config: QuireOAuthConfig
): Promise<QuireTokenData> {
  const redirectUrl = new URL(config.redirectUri);
  const expectedPath = redirectUrl.pathname || "/callback";
  const host = redirectUrl.hostname || "localhost";
  const port =
    redirectUrl.port === ""
      ? redirectUrl.protocol === "https:"
        ? 443
        : 80
      : Number.parseInt(redirectUrl.port, 10);

  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new QuireAuthError(
      `Invalid port in redirect URI: ${config.redirectUri}`,
      "OAUTH_FAILED"
    );
  }

  const state = generateState();
  const authorizeUrl = buildAuthorizeUrl(config, state);

  // Promise that resolves with the authorization code
  const { promise: codePromise, server } = createCallbackServer({
    host,
    port,
    expectedPath,
    expectedState: state,
  });

  console.error("");
  console.error("=".repeat(60));
  console.error("Quire authorization required.");
  console.error("");
  console.error("Open this URL in your browser to authorize:");
  console.error(authorizeUrl);
  console.error("");
  console.error(`Waiting for callback on ${host}:${port}${expectedPath}...`);
  console.error("=".repeat(60));
  console.error("");

  try {
    const code = await codePromise;
    console.error("[quire-mcp] Authorization code received, exchanging...");
    const tokens = await exchangeCodeForToken(config, code);
    console.error("[quire-mcp] Token exchange successful.");
    return tokens;
  } finally {
    server.close();
  }
}

// ---------------------------------------------------------------------------
// Callback Server
// ---------------------------------------------------------------------------

interface CallbackServerOptions {
  host: string;
  port: number;
  expectedPath: string;
  expectedState: string;
}

interface CallbackServerResult {
  promise: Promise<string>;
  server: http.Server;
}

function createCallbackServer(
  options: CallbackServerOptions
): CallbackServerResult {
  const { host, port, expectedPath, expectedState } = options;

  let resolveCode: (code: string) => void;
  let rejectCode: (err: Error) => void;

  const promise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = http.createServer((req, res) => {
    try {
      const reqUrl = new URL(
        req.url ?? "/",
        `http://${host}:${port.toString()}`
      );

      // Only handle the expected callback path
      if (reqUrl.pathname !== expectedPath) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlPage("Quire OAuth", "<p>Waiting for authorization...</p>"));
        return;
      }

      // Check for errors
      const error = reqUrl.searchParams.get("error");
      if (error) {
        const desc = reqUrl.searchParams.get("error_description") ?? error;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          htmlPage(
            "Authorization Failed",
            `<h1>Authorization Failed</h1><p>${escapeHtml(desc)}</p><p>You can close this tab.</p>`
          )
        );
        rejectCode(new QuireOAuthError(desc, "USER_DENIED"));
        return;
      }

      // Validate state
      const returnedState = reqUrl.searchParams.get("state");
      if (returnedState !== expectedState) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          htmlPage(
            "Invalid State",
            "<h1>Invalid State</h1><p>CSRF validation failed. Please retry.</p>"
          )
        );
        rejectCode(new QuireOAuthError("State mismatch", "OAUTH_FAILED"));
        return;
      }

      // Get code
      const code = reqUrl.searchParams.get("code");
      if (!code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          htmlPage(
            "Missing Code",
            "<h1>Missing Code</h1><p>No authorization code received.</p>"
          )
        );
        rejectCode(
          new QuireOAuthError("No authorization code", "OAUTH_FAILED")
        );
        return;
      }

      // Success!
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        htmlPage(
          "Authorization Successful",
          "<h1>Authorization Successful</h1><p>You can close this tab and return to your terminal.</p>"
        )
      );
      resolveCode(code);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal error");
      rejectCode(
        err instanceof Error ? err : new Error("Unknown callback error")
      );
    }
  });

  server.listen(port, host);

  return { promise, server };
}

// ---------------------------------------------------------------------------
// HTML Helpers
// ---------------------------------------------------------------------------

/**
 * Generate an HTML page with proper escaping.
 *
 * IMPORTANT: The body parameter accepts pre-escaped HTML content.
 * Callers are responsible for escaping user-provided content using escapeHtml().
 * This is intentional to allow structured HTML (headers, paragraphs) while
 * ensuring dynamic content is escaped at the call site.
 */
function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}
