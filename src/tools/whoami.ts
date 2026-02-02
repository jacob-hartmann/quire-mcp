/**
 * quire.whoami Tool
 *
 * Get the current authenticated user's profile from Quire.
 * This tool is useful for verifying that authentication is working
 * and for getting basic information about the current user.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQuireClient } from "../quire/client-factory.js";
import { formatError, formatAuthError, formatSuccess } from "./utils.js";

/**
 * Register the quire.whoami tool
 */
export function registerWhoamiTool(server: McpServer): void {
  server.registerTool(
    "quire.whoami",
    {
      description:
        "Get the current authenticated user's profile from Quire. " +
        "Use this to verify your authentication is working and to see " +
        "basic information about the connected Quire account.",
    },
    async (extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const userResult = await clientResult.client.getMe();
      if (!userResult.success) {
        return formatError(userResult.error, "user");
      }

      return formatSuccess(userResult.data);
    }
  );
}
