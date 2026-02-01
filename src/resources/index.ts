/**
 * MCP Resources Registration
 *
 * Registers all available resources with the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUserMeResource } from "./user-me.js";

/**
 * Register all resources with the MCP server
 */
export function registerResources(server: McpServer): void {
  registerUserMeResource(server);
}
