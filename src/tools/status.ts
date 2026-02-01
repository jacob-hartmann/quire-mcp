/**
 * Status Tools
 *
 * MCP tools for managing Quire custom statuses.
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
function formatError(error: { code: string; message: string }): ToolErrorResponse {
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
      errorMessage = "The requested status was not found.";
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
 * Register all status tools with the MCP server
 */
export function registerStatusTools(server: McpServer): void {
  // List Statuses
  server.registerTool(
    "quire.listStatuses",
    {
      description:
        "List all custom statuses in a project. Returns an array of status objects " +
        "with value, name, and color. Default statuses (0=To-Do, 100=Complete) " +
        "are always available.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
      }),
    },
    async ({ projectId }, extra) => {
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

      const result = await clientResult.client.listStatuses(projectId);
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

  // Get Status
  server.registerTool(
    "quire.getStatus",
    {
      description:
        "Get detailed information about a specific custom status by its value.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        value: z
          .number()
          .min(0)
          .max(100)
          .describe("The status value (0-100)"),
      }),
    },
    async ({ projectId, value }, extra) => {
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

      const result = await clientResult.client.getStatus(projectId, value);
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

  // Create Status
  server.registerTool(
    "quire.createStatus",
    {
      description:
        "Create a custom status in a project. Custom statuses allow you to " +
        "define workflow stages beyond the default To-Do (0) and Complete (100).",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        name: z.string().describe("The status name (required)"),
        color: z
          .string()
          .optional()
          .describe("Status color (hex code without #, e.g., 'ff5733')"),
      }),
    },
    async ({ projectId, name, color }, extra) => {
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

      const params: { name: string; color?: string } = { name };
      if (color !== undefined) params.color = color;

      const result = await clientResult.client.createStatus(projectId, params);
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

  // Update Status
  server.registerTool(
    "quire.updateStatus",
    {
      description: "Update a custom status's name or color.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        value: z
          .number()
          .min(0)
          .max(100)
          .describe("The status value (0-100) to update"),
        name: z.string().optional().describe("New name for the status"),
        color: z
          .string()
          .optional()
          .describe("New color (hex code without #, e.g., 'ff5733')"),
      }),
    },
    async ({ projectId, value, name, color }, extra) => {
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

      const params: { name?: string; color?: string } = {};
      if (name !== undefined) params.name = name;
      if (color !== undefined) params.color = color;

      const result = await clientResult.client.updateStatus(
        projectId,
        value,
        params
      );
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

  // Delete Status
  server.registerTool(
    "quire.deleteStatus",
    {
      description:
        "Delete a custom status. Tasks with this status will be reverted to " +
        "the default To-Do status. You cannot delete the default statuses (0 and 100).",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        value: z
          .number()
          .min(1)
          .max(99)
          .describe(
            "The status value (1-99) to delete. Cannot delete 0 (To-Do) or 100 (Complete)"
          ),
      }),
    },
    async ({ projectId, value }, extra) => {
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

      const result = await clientResult.client.deleteStatus(projectId, value);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Status with value ${value} deleted successfully.`,
          },
        ],
      };
    }
  );
}
