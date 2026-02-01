/**
 * HTTP Server Configuration
 *
 * Configuration for the HTTP transport mode with OAuth proxy.
 */

import { DEFAULT_SERVER_PORT } from "../constants.js";

/**
 * Configuration for the HTTP server
 */
export interface HttpServerConfig {
  /** Host to bind the server to */
  host: string;
  /** Port to listen on */
  port: number;
  /** Base URL for OAuth endpoints (issuer URL) */
  issuerUrl: string;
  /** Quire OAuth client ID */
  quireClientId: string;
  /** Quire OAuth client secret */
  quireClientSecret: string;
  /** Callback URL for Quire OAuth (our server's callback endpoint) */
  quireRedirectUri: string;
}

/**
 * Check if a URL is using localhost or loopback address
 */
function isLocalhost(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

/**
 * Load HTTP server config from environment variables.
 * Returns undefined if required OAuth credentials are not set.
 */
export function getHttpServerConfig(): HttpServerConfig | undefined {
  const quireClientId = process.env["QUIRE_OAUTH_CLIENT_ID"];
  const quireClientSecret = process.env["QUIRE_OAUTH_CLIENT_SECRET"];

  if (!quireClientId || !quireClientSecret) {
    return undefined;
  }

  const host = process.env["MCP_SERVER_HOST"] ?? "127.0.0.1";
  const port = parseInt(process.env["MCP_SERVER_PORT"] ?? DEFAULT_SERVER_PORT, 10);
  // Use localhost in issuer URL for client compatibility (127.0.0.1 != localhost for OAuth)
  const issuerUrl = process.env["MCP_ISSUER_URL"] ?? `http://localhost:${port}`;
  const quireRedirectUri =
    process.env["QUIRE_OAUTH_REDIRECT_URI"] ?? `${issuerUrl}/oauth/callback`;

  // Security: Require HTTPS for non-localhost URLs
  if (!isLocalhost(issuerUrl) && !issuerUrl.startsWith("https://")) {
    console.error(
      "[quire-mcp] ERROR: MCP_ISSUER_URL is using HTTP for a non-localhost address."
    );
    console.error(
      "[quire-mcp] This is insecure and may expose OAuth tokens to man-in-the-middle attacks."
    );
    console.error(
      "[quire-mcp] For production use, configure HTTPS with MCP_ISSUER_URL=https://..."
    );
    return undefined;
  }

  return {
    host,
    port,
    issuerUrl,
    quireClientId,
    quireClientSecret,
    quireRedirectUri,
  };
}
