/**
 * MCP Tools Registration
 *
 * Registers all available tools with the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWhoamiTool } from "./whoami.js";
import { registerOrganizationTools } from "./organization.js";
import { registerProjectTools } from "./project.js";
import { registerTaskTools } from "./task.js";
import { registerTagTools } from "./tag.js";
import { registerCommentTools } from "./comment.js";
import { registerUserTools } from "./user.js";
import { registerStatusTools } from "./status.js";

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: McpServer): void {
  registerWhoamiTool(server);
  registerOrganizationTools(server);
  registerProjectTools(server);
  registerTaskTools(server);
  registerTagTools(server);
  registerCommentTools(server);
  registerUserTools(server);
  registerStatusTools(server);
}
