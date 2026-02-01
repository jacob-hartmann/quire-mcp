/**
 * Chat Tools
 *
 * MCP tools for managing Quire chat channels.
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
      errorMessage = "The requested chat channel was not found.";
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
 * Register all chat tools with the MCP server
 */
export function registerChatTools(server: McpServer): void {
  // Create Chat
  server.registerTool(
    "quire.createChat",
    {
      description: "Create a new chat channel in an organization or project.",
      inputSchema: z.object({
        ownerType: z
          .enum(["organization", "project"])
          .describe("The type of owner: 'organization' or 'project'"),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-org' or 'my-project') or OID"),
        name: z.string().describe("The chat channel name"),
        description: z
          .string()
          .optional()
          .describe("The chat channel description"),
        members: z
          .array(z.string())
          .optional()
          .describe("Array of user IDs to add as members"),
      }),
    },
    async ({ ownerType, ownerId, name, description, members }, extra) => {
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

      const params: { name: string; description?: string; members?: string[] } =
        { name };
      if (description !== undefined) params.description = description;
      if (members !== undefined) params.members = members;

      const result = await clientResult.client.createChat(
        ownerType,
        ownerId,
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

  // Get Chat
  server.registerTool(
    "quire.getChat",
    {
      description:
        "Get a chat channel by OID, or by owner type/ID and chat ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The chat channel OID (unique identifier). Use this OR ownerType+ownerId+chatId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using chatId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using chatId)"),
        chatId: z.string().optional().describe("The chat ID within the owner"),
      }),
    },
    async ({ oid, ownerType, ownerId, chatId }, extra) => {
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

      // Validate input combinations
      if (!oid && (!ownerType || !ownerId || !chatId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'chatId'",
            },
          ],
        };
      }

      let result;
      if (oid) {
        result = await clientResult.client.getChat(oid);
      } else if (ownerType && ownerId && chatId) {
        result = await clientResult.client.getChat(ownerType, ownerId, chatId);
      } else {
        // Should never happen due to validation above
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid parameters",
            },
          ],
        };
      }

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

  // List Chats
  server.registerTool(
    "quire.listChats",
    {
      description: "List all chat channels in an organization or project.",
      inputSchema: z.object({
        ownerType: z
          .enum(["organization", "project"])
          .describe("The type of owner: 'organization' or 'project'"),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-org' or 'my-project') or OID"),
      }),
    },
    async ({ ownerType, ownerId }, extra) => {
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

      const result = await clientResult.client.listChats(ownerType, ownerId);
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

  // Update Chat
  server.registerTool(
    "quire.updateChat",
    {
      description:
        "Update a chat channel's name, description, or members by OID, or by owner type/ID and chat ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The chat channel OID (unique identifier). Use this OR ownerType+ownerId+chatId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using chatId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using chatId)"),
        chatId: z.string().optional().describe("The chat ID within the owner"),
        name: z.string().optional().describe("New chat channel name"),
        description: z
          .string()
          .optional()
          .describe("New chat channel description"),
        members: z
          .array(z.string())
          .optional()
          .describe("Replace all members with this list of user IDs"),
        addMembers: z
          .array(z.string())
          .optional()
          .describe("User IDs to add as members"),
        removeMembers: z
          .array(z.string())
          .optional()
          .describe("User IDs to remove from members"),
      }),
    },
    async (
      {
        oid,
        ownerType,
        ownerId,
        chatId,
        name,
        description,
        members,
        addMembers,
        removeMembers,
      },
      extra
    ) => {
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

      // Validate input combinations
      if (!oid && (!ownerType || !ownerId || !chatId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'chatId'",
            },
          ],
        };
      }

      const params: {
        name?: string;
        description?: string;
        members?: string[];
        addMembers?: string[];
        removeMembers?: string[];
      } = {};
      if (name !== undefined) params.name = name;
      if (description !== undefined) params.description = description;
      if (members !== undefined) params.members = members;
      if (addMembers !== undefined) params.addMembers = addMembers;
      if (removeMembers !== undefined) params.removeMembers = removeMembers;

      let result;
      if (oid) {
        result = await clientResult.client.updateChat(oid, params);
      } else if (ownerType && ownerId && chatId) {
        result = await clientResult.client.updateChat(
          ownerType,
          ownerId,
          chatId,
          params
        );
      } else {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid parameters",
            },
          ],
        };
      }

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

  // Delete Chat
  server.registerTool(
    "quire.deleteChat",
    {
      description:
        "Delete a chat channel by OID, or by owner type/ID and chat ID. This action cannot be undone.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The chat channel OID (unique identifier). Use this OR ownerType+ownerId+chatId"
          ),
        ownerType: z
          .enum(["organization", "project"])
          .optional()
          .describe("The type of owner (required when using chatId)"),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using chatId)"),
        chatId: z
          .string()
          .optional()
          .describe("The chat ID within the owner to delete"),
      }),
    },
    async ({ oid, ownerType, ownerId, chatId }, extra) => {
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

      // Validate input combinations
      if (!oid && (!ownerType || !ownerId || !chatId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'chatId'",
            },
          ],
        };
      }

      let result;
      if (oid) {
        result = await clientResult.client.deleteChat(oid);
      } else if (ownerType && ownerId && chatId) {
        result = await clientResult.client.deleteChat(
          ownerType,
          ownerId,
          chatId
        );
      } else {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Invalid parameters",
            },
          ],
        };
      }

      if (!result.success) {
        return formatError(result.error);
      }

      const identifier = oid ?? `${ownerType}/${ownerId}/${chatId}`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Chat channel ${identifier} deleted successfully.`,
          },
        ],
      };
    }
  );
}
