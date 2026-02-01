/**
 * Token Store
 *
 * Persists Quire OAuth tokens to the local filesystem.
 * Default location:
 *   - Windows: %APPDATA%\quire-mcp\tokens.json
 *   - macOS:   ~/Library/Application Support/quire-mcp/tokens.json
 *   - Linux:   ~/.config/quire-mcp/tokens.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { QuireTokenData } from "./oauth.js";

// ---------------------------------------------------------------------------
// Path Helpers
// ---------------------------------------------------------------------------

/**
 * Get the default token store directory based on platform conventions.
 */
function getDefaultStoreDir(): string {
  const platform = process.platform;

  if (platform === "win32") {
    // %APPDATA%\quire-mcp
    const appData = process.env["APPDATA"];
    if (appData) {
      return join(appData, "quire-mcp");
    }
    // Fallback
    return join(homedir(), "AppData", "Roaming", "quire-mcp");
  }

  if (platform === "darwin") {
    // ~/Library/Application Support/quire-mcp
    return join(homedir(), "Library", "Application Support", "quire-mcp");
  }

  // Linux / other: ~/.config/quire-mcp
  const xdgConfig = process.env["XDG_CONFIG_HOME"];
  if (xdgConfig) {
    return join(xdgConfig, "quire-mcp");
  }
  return join(homedir(), ".config", "quire-mcp");
}

/**
 * Get the token store file path.
 * Respects QUIRE_TOKEN_STORE_PATH env var if set.
 */
export function getTokenStorePath(): string {
  const envPath = process.env["QUIRE_TOKEN_STORE_PATH"];
  if (envPath) {
    return envPath;
  }
  return join(getDefaultStoreDir(), "tokens.json");
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

/**
 * Load tokens from disk. Returns undefined if file doesn't exist or is invalid.
 */
export function loadTokens(): QuireTokenData | undefined {
  const path = getTokenStorePath();

  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const data: unknown = JSON.parse(raw);

    // Basic validation
    if (
      typeof data === "object" &&
      data !== null &&
      "accessToken" in data &&
      typeof (data as Record<string, unknown>)["accessToken"] === "string"
    ) {
      return data as QuireTokenData;
    }

    console.error("[quire-mcp] Token store file has invalid structure");
    return undefined;
  } catch (err) {
    console.error("[quire-mcp] Failed to load token store:", err);
    return undefined;
  }
}

/**
 * Save tokens to disk. Creates parent directories if needed.
 */
export function saveTokens(tokens: QuireTokenData): void {
  const path = getTokenStorePath();
  const dir = dirname(path);

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(path, JSON.stringify(tokens, null, 2), {
      encoding: "utf-8",
      mode: 0o600, // Owner read/write only
    });
  } catch (err) {
    console.error("[quire-mcp] Failed to save token store:", err);
    throw err;
  }
}

/**
 * Clear stored tokens (e.g., on logout or revocation).
 */
export function clearTokens(): void {
  const path = getTokenStorePath();

  if (existsSync(path)) {
    try {
      writeFileSync(path, "{}", { encoding: "utf-8", mode: 0o600 });
    } catch (err) {
      console.error("[quire-mcp] Failed to clear token store:", err);
    }
  }
}
