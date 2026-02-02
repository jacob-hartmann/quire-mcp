#!/usr/bin/env node
/**
 * Quire MCP Server
 *
 * A Model Context Protocol (MCP) server for Quire project management.
 *
 * This server provides:
 * - Tool: quire.whoami - Get the current authenticated user's profile
 * - Resource: quire://user/me - Access the current user's profile data
 * - Prompt: quire.setup_env_token - Instructions for setting up authentication
 *
 * Supports two transport modes:
 * - stdio (default): JSON-RPC over stdin/stdout
 * - http: HTTP transport with OAuth authorization
 *
 * Set MCP_TRANSPORT=http to use HTTP mode.
 *
 * All logging goes to stderr to avoid corrupting JSON-RPC over stdout.
 *
 * @see https://modelcontextprotocol.io/
 * @see https://quire.io/dev/api/
 */

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

const SERVER_NAME = "quire-mcp";

// Read version from package.json to keep it in sync
const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };
const SERVER_VERSION = packageJson.version;

/**
 * Start the server in stdio mode
 */
async function startStdioServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] Server running on stdio transport`);
}

/**
 * Create an MCP server with all handlers registered
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

/**
 * Start the server in HTTP mode with OAuth
 */
async function startHttpServerMode(): Promise<void> {
  const { getHttpServerConfig, startHttpServer } =
    await import("./server/index.js");

  const config = getHttpServerConfig();
  if (!config) {
    console.error(
      `[${SERVER_NAME}] Error: HTTP mode requires OAuth configuration.`
    );
    console.error(
      `[${SERVER_NAME}] Please set QUIRE_OAUTH_CLIENT_ID and QUIRE_OAUTH_CLIENT_SECRET.`
    );
    process.exit(1);
  }

  await startHttpServer(createServer, config);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const transport = process.env["MCP_TRANSPORT"] ?? "stdio";
  console.error(
    `[${SERVER_NAME}] Starting server v${SERVER_VERSION} (${transport} transport)...`
  );

  // Start with appropriate transport
  if (transport === "http") {
    await startHttpServerMode();
  } else {
    await startStdioServer(createServer());
  }
}

// Run the server
main().catch((error: unknown) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});
