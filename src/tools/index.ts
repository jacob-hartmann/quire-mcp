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
import { registerPartnerTools } from "./partner.js";
import { registerDocumentTools } from "./document.js";
import { registerSublistTools } from "./sublist.js";
import { registerChatTools } from "./chat.js";
import { registerStorageTools } from "./storage.js";
import { registerNotificationTools } from "./notification.js";
import { registerAttachmentTools } from "./attachment.js";

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
  registerPartnerTools(server);
  registerDocumentTools(server);
  registerSublistTools(server);
  registerChatTools(server);
  registerStorageTools(server);
  registerNotificationTools(server);
  registerAttachmentTools(server);
}
