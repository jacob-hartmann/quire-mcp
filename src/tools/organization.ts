/**
 * Organization Tools
 *
 * MCP tools for managing Quire organizations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuireClient } from "../quire/client-factory.js";

interface ToolTextContent {
  type: "text";
  text: string;
}

interface ToolErrorResponse {
  [x: string]: unknown;
  isError: true;
  content: ToolTextContent[];
}

/**
 * Format error response for MCP tools
 */
function formatError(error: {
  code: string;
  message: string;
}): ToolErrorResponse {
  let errorMessage = error.message;

  switch (error.code) {
    case "UNAUTHORIZED":
      errorMessage =
        "Your access token is invalid or expired. " +
        "Delete the cached tokens and re-authorize via OAuth.";
      break;
    case "FORBIDDEN":
      errorMessage =
        "Your access token does not have permission to access this resource.";
      break;
    case "NOT_FOUND":
      errorMessage = "The requested organization was not found.";
      break;
    case "RATE_LIMITED":
      errorMessage =
        "You have exceeded Quire's rate limit. " +
        "Please wait a moment before trying again.";
      break;
  }

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `Quire API Error (${error.code}): ${errorMessage}`,
      },
    ],
  };
}

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
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      const result = await clientResult.client.listOrganizations();
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
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
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      const result = await clientResult.client.getOrganization(id);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
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
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Authentication Error: ${clientResult.error}`,
            },
          ],
        };
      }

      // Build params object, filtering out undefined values
      const params: {
        followers?: string[];
        addFollowers?: string[];
        removeFollowers?: string[];
      } = {};
      if (followers !== undefined) params.followers = followers;
      if (addFollowers !== undefined) params.addFollowers = addFollowers;
      if (removeFollowers !== undefined)
        params.removeFollowers = removeFollowers;

      const result = await clientResult.client.updateOrganization(id, params);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );
}
