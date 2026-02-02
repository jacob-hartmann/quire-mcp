/**
 * Comment Tools
 *
 * MCP tools for managing Quire task comments.
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
} from "./utils.js";

/**
 * Register all comment tools with the MCP server
 */
export function registerCommentTools(server: McpServer): void {
  // List Task Comments
  server.registerTool(
    "quire.listTaskComments",
    {
      description:
        "List all comments on a task. Can be accessed by task OID " +
        "or by project ID + task number.",
      inputSchema: z.object({
        taskOid: z
          .string()
          .optional()
          .describe(
            "The task OID (unique identifier). Use this OR projectId+taskId"
          ),
        projectId: z
          .string()
          .optional()
          .describe(
            "The project ID (required when using taskId, not needed when using taskOid)"
          ),
        taskId: z
          .number()
          .optional()
          .describe("The task ID number within the project"),
      }),
    },
    async ({ taskOid, projectId, taskId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // List comments by taskOid or by projectId + taskId
      let result;
      if (taskOid) {
        result = await clientResult.client.listTaskComments(taskOid);
      } else if (projectId && taskId !== undefined) {
        result = await clientResult.client.listTaskComments(projectId, taskId);
      } else {
        return formatValidationError(
          "Must provide either 'taskOid' or both 'projectId' and 'taskId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "comment");
      }

      return formatSuccess(result.data);
    }
  );

  // Add Task Comment
  server.registerTool(
    "quire.addTaskComment",
    {
      description:
        "Add a comment to a task. Can be accessed by task OID " +
        "or by project ID + task number.",
      inputSchema: z.object({
        taskOid: z
          .string()
          .optional()
          .describe(
            "The task OID (unique identifier). Use this OR projectId+taskId"
          ),
        projectId: z
          .string()
          .optional()
          .describe(
            "The project ID (required when using taskId, not needed when using taskOid)"
          ),
        taskId: z
          .number()
          .optional()
          .describe("The task ID number within the project"),
        description: z.string().describe("The comment text in markdown format"),
      }),
    },
    async ({ taskOid, projectId, taskId, description }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // Add comment by taskOid or by projectId + taskId
      let result;
      if (taskOid) {
        result = await clientResult.client.addTaskComment(taskOid, {
          description,
        });
      } else if (projectId && taskId !== undefined) {
        result = await clientResult.client.addTaskComment(projectId, taskId, {
          description,
        });
      } else {
        return formatValidationError(
          "Must provide either 'taskOid' or both 'projectId' and 'taskId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "comment");
      }

      return formatSuccess(result.data);
    }
  );

  // Update Comment
  server.registerTool(
    "quire.updateComment",
    {
      description: "Update an existing comment's text.",
      inputSchema: z.object({
        oid: z.string().describe("The comment OID (unique identifier)"),
        description: z
          .string()
          .describe("The new comment text in markdown format"),
      }),
    },
    async ({ oid, description }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.updateComment(oid, {
        description,
      });
      if (!result.success) {
        return formatError(result.error, "comment");
      }

      return formatSuccess(result.data);
    }
  );

  // Delete Comment
  server.registerTool(
    "quire.deleteComment",
    {
      description: "Delete a comment. This action cannot be undone.",
      inputSchema: z.object({
        oid: z
          .string()
          .describe("The comment OID (unique identifier) to delete"),
      }),
    },
    async ({ oid }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.deleteComment(oid);
      if (!result.success) {
        return formatError(result.error, "comment");
      }

      return formatMessage(`Comment ${oid} deleted successfully.`);
    }
  );

  // List Chat Comments
  server.registerTool(
    "quire.listChatComments",
    {
      description:
        "List all comments on a chat channel by OID, or by project ID and chat ID.",
      inputSchema: z.object({
        chatOid: z
          .string()
          .optional()
          .describe(
            "The chat channel OID (unique identifier). Use this OR projectId+chatId"
          ),
        projectId: z
          .string()
          .optional()
          .describe("The project ID or OID (required when using chatId)"),
        chatId: z
          .string()
          .optional()
          .describe("The chat ID within the project"),
      }),
    },
    async ({ chatOid, projectId, chatId }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // List comments by chatOid or by projectId + chatId
      let result;
      if (chatOid) {
        result = await clientResult.client.listChatComments(chatOid);
      } else if (projectId && chatId) {
        result = await clientResult.client.listChatComments(projectId, chatId);
      } else {
        return formatValidationError(
          "Must provide either 'chatOid' or both 'projectId' and 'chatId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "comment");
      }

      return formatSuccess(result.data);
    }
  );

  // Add Chat Comment
  server.registerTool(
    "quire.addChatComment",
    {
      description:
        "Add a comment to a chat channel by OID, or by project ID and chat ID.",
      inputSchema: z.object({
        chatOid: z
          .string()
          .optional()
          .describe(
            "The chat channel OID (unique identifier). Use this OR projectId+chatId"
          ),
        projectId: z
          .string()
          .optional()
          .describe("The project ID or OID (required when using chatId)"),
        chatId: z
          .string()
          .optional()
          .describe("The chat ID within the project"),
        description: z.string().describe("The comment text in markdown format"),
      }),
    },
    async ({ chatOid, projectId, chatId, description }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      // Add comment by chatOid or by projectId + chatId
      let result;
      if (chatOid) {
        result = await clientResult.client.addChatComment(chatOid, {
          description,
        });
      } else if (projectId && chatId) {
        result = await clientResult.client.addChatComment(projectId, chatId, {
          description,
        });
      } else {
        return formatValidationError(
          "Must provide either 'chatOid' or both 'projectId' and 'chatId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "comment");
      }

      return formatSuccess(result.data);
    }
  );
}
