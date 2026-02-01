/**
 * Storage Tools
 *
 * MCP tools for managing Quire key-value storage.
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
      errorMessage = "The requested storage entry was not found.";
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
 * Register all storage tools with the MCP server
 */
export function registerStorageTools(server: McpServer): void {
  // Get Storage Value
  server.registerTool(
    "quire.getStorageValue",
    {
      description: "Get a stored value by name from Quire's key-value storage.",
      inputSchema: z.object({
        name: z.string().describe("The storage key name"),
      }),
    },
    async ({ name }, extra) => {
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

      const result = await clientResult.client.getStorageValue(name);
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

  // List Storage Entries
  server.registerTool(
    "quire.listStorageEntries",
    {
      description:
        "List all storage entries with a given prefix. " +
        "Useful for finding related stored values.",
      inputSchema: z.object({
        prefix: z
          .string()
          .describe("The prefix to filter storage keys (e.g., 'config/')"),
      }),
    },
    async ({ prefix }, extra) => {
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

      const result = await clientResult.client.listStorageEntries(prefix);
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

  // Put Storage Value
  server.registerTool(
    "quire.putStorageValue",
    {
      description:
        "Store a value in Quire's key-value storage. " +
        "Overwrites any existing value with the same name.",
      inputSchema: z.object({
        name: z.string().describe("The storage key name"),
        value: z
          .unknown()
          .describe("The value to store (can be any JSON-serializable value)"),
      }),
    },
    async ({ name, value }, extra) => {
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

      const result = await clientResult.client.putStorageValue(name, value);
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

  // Delete Storage Value
  server.registerTool(
    "quire.deleteStorageValue",
    {
      description:
        "Delete a stored value by name. This action cannot be undone.",
      inputSchema: z.object({
        name: z.string().describe("The storage key name to delete"),
      }),
    },
    async ({ name }, extra) => {
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

      const result = await clientResult.client.deleteStorageValue(name);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Storage entry '${name}' deleted successfully.`,
          },
        ],
      };
    }
  );
}
