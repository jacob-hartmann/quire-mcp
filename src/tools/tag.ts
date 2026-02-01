/**
 * Tag Tools
 *
 * MCP tools for managing Quire tags.
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
      errorMessage = "The requested tag was not found.";
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
 * Register all tag tools with the MCP server
 */
export function registerTagTools(server: McpServer): void {
  // List Tags
  server.registerTool(
    "quire.listTags",
    {
      description:
        "List all tags in a project. Returns an array of tag objects " +
        "with name, color, and identifiers.",
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

      const result = await clientResult.client.listTags(projectId);
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

  // Get Tag
  server.registerTool(
    "quire.getTag",
    {
      description: "Get detailed information about a specific tag by its OID.",
      inputSchema: z.object({
        oid: z.string().describe("The tag OID (unique identifier)"),
      }),
    },
    async ({ oid }, extra) => {
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

      const result = await clientResult.client.getTag(oid);
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

  // Create Tag
  server.registerTool(
    "quire.createTag",
    {
      description:
        "Create a new tag in a project. Tags help organize and categorize tasks.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        name: z.string().describe("The tag name (required)"),
        color: z
          .string()
          .optional()
          .describe("Tag color (hex code without #, e.g., 'ff5733')"),
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

      const result = await clientResult.client.createTag(projectId, params);
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

  // Update Tag
  server.registerTool(
    "quire.updateTag",
    {
      description: "Update a tag's name or color.",
      inputSchema: z.object({
        oid: z.string().describe("The tag OID (unique identifier)"),
        name: z.string().optional().describe("New name for the tag"),
        color: z
          .string()
          .optional()
          .describe("New color (hex code without #, e.g., 'ff5733')"),
      }),
    },
    async ({ oid, name, color }, extra) => {
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

      const result = await clientResult.client.updateTag(oid, params);
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

  // Delete Tag
  server.registerTool(
    "quire.deleteTag",
    {
      description:
        "Delete a tag. This will remove the tag from all tasks that have it.",
      inputSchema: z.object({
        oid: z.string().describe("The tag OID (unique identifier) to delete"),
      }),
    },
    async ({ oid }, extra) => {
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

      const result = await clientResult.client.deleteTag(oid);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Tag ${oid} deleted successfully.`,
          },
        ],
      };
    }
  );
}
