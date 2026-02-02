/**
 * User Tools
 *
 * MCP tools for managing Quire users.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuireClient } from "../quire/client-factory.js";
import { formatError, formatAuthError, formatSuccess } from "./utils.js";

/**
 * Register all user tools with the MCP server
 */
export function registerUserTools(server: McpServer): void {
  // Get User
  server.registerTool(
    "quire.getUser",
    {
      description:
        "Get detailed information about a user by their ID, OID, or email. " +
        "Returns user profile including name, email, and image.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The user ID (e.g., 'john-doe'), OID (unique identifier), or email address"
          ),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.getUser(id);
      if (!result.success) {
        return formatError(result.error, "user");
      }

      return formatSuccess(result.data);
    }
  );

  // List Users
  server.registerTool(
    "quire.listUsers",
    {
      description:
        "List all users accessible to the current user. " +
        "Returns an array of user objects with basic profile information.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async (_args, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listUsers();
      if (!result.success) {
        return formatError(result.error, "user");
      }

      return formatSuccess(result.data);
    }
  );

  // List Project Members
  server.registerTool(
    "quire.listProjectMembers",
    {
      description:
        "List all members of a project. " +
        "Returns an array of user objects who have access to the project.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ projectId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listProjectMembers(projectId);
      if (!result.success) {
        return formatError(result.error, "user");
      }

      return formatSuccess(result.data);
    }
  );
}
