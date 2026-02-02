/**
 * Organization Tools
 *
 * MCP tools for managing Quire organizations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuireClient } from "../quire/client-factory.js";
import {
  formatError,
  formatAuthError,
  formatSuccess,
  buildParams,
} from "./utils.js";

/**
 * Register all organization tools with the MCP server
 */
export function registerOrganizationTools(server: McpServer): void {
  // List Organizations
  server.registerTool(
    "quire.listOrganizations",
    {
      description:
        "List all organizations accessible to the current user. " +
        "Returns an array of organization objects with basic information.",
    },
    async (extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listOrganizations();
      if (!result.success) {
        return formatError(result.error, "organization");
      }

      return formatSuccess(result.data);
    }
  );

  // Get Organization
  server.registerTool(
    "quire.getOrganization",
    {
      description:
        "Get detailed information about a specific organization by its ID or OID. " +
        "Use this to get full details including member count, project count, and followers.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The organization ID (e.g., 'my-organization') or OID (unique identifier)"
          ),
      }),
    },
    async ({ id }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.getOrganization(id);
      if (!result.success) {
        return formatError(result.error, "organization");
      }

      return formatSuccess(result.data);
    }
  );

  // Update Organization
  server.registerTool(
    "quire.updateOrganization",
    {
      description:
        "Update an organization's followers. You can set the complete list of followers, " +
        "or add/remove specific followers.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The organization ID (e.g., 'my-organization') or OID (unique identifier)"
          ),
        followers: z
          .array(z.string())
          .optional()
          .describe(
            "Replace all followers with this list of user IDs (optional)"
          ),
        addFollowers: z
          .array(z.string())
          .optional()
          .describe("User IDs to add as followers (optional)"),
        removeFollowers: z
          .array(z.string())
          .optional()
          .describe("User IDs to remove from followers (optional)"),
      }),
    },
    async ({ id, followers, addFollowers, removeFollowers }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({ followers, addFollowers, removeFollowers });

      const result = await clientResult.client.updateOrganization(id, params);
      if (!result.success) {
        return formatError(result.error, "organization");
      }

      return formatSuccess(result.data);
    }
  );
}
