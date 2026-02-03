/**
 * Chat Tools
 *
 * MCP tools for managing Quire chat channels.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuireClient } from "../quire/client-factory.js";
import {
  formatError,
  formatAuthError,
  formatSuccess,
  formatMessage,
  formatValidationError,
  buildParams,
} from "./utils.js";

/**
 * Register all chat tools with the MCP server
 */
export function registerChatTools(server: McpServer): void {
  // Create Chat
  server.registerTool(
    "quire.createChat",
    {
      description: "Create a new chat channel in a project.",
      inputSchema: z.object({
        ownerType: z
          .enum(["project"])
          .default("project")
          .describe("The type of owner (currently only 'project' is supported)"),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-project') or OID"),
        name: z.string().describe("The chat channel name"),
        id: z
          .string()
          .optional()
          .describe(
            "Custom ID for this chat channel. If omitted, Quire generates one automatically. Must be unique within the project."
          ),
        description: z
          .string()
          .optional()
          .describe("The chat channel description (Markdown supported)"),
        iconColor: z
          .string()
          .optional()
          .describe("Icon color index from Quire's predefined palette"),
        image: z
          .string()
          .optional()
          .describe(
            "Icon image identifier (e.g., 'icon-view-list', 'icon-briefcase-o', etc.)"
          ),
        partner: z
          .string()
          .optional()
          .describe("OID of the external team this chat channel belongs to"),
        start: z
          .string()
          .optional()
          .describe("Target start date (ISO 8601 format, e.g., '2024-01-02')"),
        due: z
          .string()
          .optional()
          .describe("Target due date (ISO 8601 format, e.g., '2024-05-25')"),
      }),
    },
    async (
      {
        ownerType,
        ownerId,
        name,
        id,
        description,
        iconColor,
        image,
        partner,
        start,
        due,
      },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
        name,
        id,
        description,
        iconColor,
        image,
        partner,
        start,
        due,
      });

      const result = await clientResult.client.createChat(
        ownerType,
        ownerId,
        params as { name: string }
      );
      if (!result.success) {
        return formatError(result.error, "chat channel");
      }

      return formatSuccess(result.data);
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
          .enum(["project"])
          .optional()
          .describe(
            "The type of owner (currently only 'project' is supported, required when using chatId)"
          ),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using chatId)"),
        chatId: z.string().optional().describe("The chat ID within the owner"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ oid, ownerType, ownerId, chatId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // Get chat by OID or by ownerType + ownerId + chatId
      let result;
      if (oid) {
        result = await clientResult.client.getChat(oid);
      } else if (ownerType && ownerId && chatId) {
        result = await clientResult.client.getChat(ownerType, ownerId, chatId);
      } else {
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'chatId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "chat channel");
      }

      return formatSuccess(result.data);
    }
  );

  // List Chats
  server.registerTool(
    "quire.listChats",
    {
      description: "List all chat channels in a project.",
      inputSchema: z.object({
        ownerType: z
          .enum(["project"])
          .default("project")
          .describe("The type of owner (currently only 'project' is supported)"),
        ownerId: z
          .string()
          .describe("The owner ID (e.g., 'my-project') or OID"),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ ownerType, ownerId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listChats(ownerType, ownerId);
      if (!result.success) {
        return formatError(result.error, "chat channel");
      }

      return formatSuccess(result.data);
    }
  );

  // Update Chat
  server.registerTool(
    "quire.updateChat",
    {
      description:
        "Update a chat channel's properties by OID, or by owner type/ID and chat ID.",
      inputSchema: z.object({
        oid: z
          .string()
          .optional()
          .describe(
            "The chat channel OID (unique identifier). Use this OR ownerType+ownerId+chatId"
          ),
        ownerType: z
          .enum(["project"])
          .optional()
          .describe(
            "The type of owner (currently only 'project' is supported, required when using chatId)"
          ),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using chatId)"),
        chatId: z.string().optional().describe("The chat ID within the owner"),
        name: z.string().optional().describe("New chat channel name"),
        id: z.string().optional().describe("New ID for this chat channel"),
        description: z
          .string()
          .optional()
          .describe("New chat channel description (Markdown supported)"),
        iconColor: z
          .string()
          .optional()
          .describe("Icon color index from Quire's predefined palette"),
        archived: z
          .boolean()
          .optional()
          .describe(
            "Archive toggle. Specify true to archive; false to unarchive"
          ),
        start: z
          .string()
          .optional()
          .describe("Target start date (ISO 8601 format, e.g., '2024-01-02')"),
        due: z
          .string()
          .optional()
          .describe("Target due date (ISO 8601 format, e.g., '2024-05-25')"),
        image: z
          .string()
          .optional()
          .describe(
            "Icon image identifier (e.g., 'icon-view-list', 'icon-briefcase-o', etc.)"
          ),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async (
      {
        oid,
        ownerType,
        ownerId,
        chatId,
        name,
        id,
        description,
        iconColor,
        archived,
        start,
        due,
        image,
      },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
        name,
        id,
        description,
        iconColor,
        archived,
        start,
        due,
        image,
      });

      // Update chat by OID or by ownerType + ownerId + chatId
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
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'chatId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "chat channel");
      }

      return formatSuccess(result.data);
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
          .enum(["project"])
          .optional()
          .describe(
            "The type of owner (currently only 'project' is supported, required when using chatId)"
          ),
        ownerId: z
          .string()
          .optional()
          .describe("The owner ID or OID (required when using chatId)"),
        chatId: z
          .string()
          .optional()
          .describe("The chat ID within the owner to delete"),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async ({ oid, ownerType, ownerId, chatId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // Delete chat by OID or by ownerType + ownerId + chatId
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
        return formatValidationError(
          "Must provide either 'oid' or all of 'ownerType', 'ownerId', and 'chatId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "chat channel");
      }

      const identifier = oid ?? `${ownerType}/${ownerId}/${chatId}`;
      return formatMessage(`Chat channel ${identifier} deleted successfully.`);
    }
  );
}
