/**
 * Comment Tools
 *
 * MCP tools for managing Quire task comments.
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
      errorMessage = "The requested comment or task was not found.";
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
      if (!taskOid && (!projectId || taskId === undefined)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'taskOid' or both 'projectId' and 'taskId'",
            },
          ],
        };
      }

      if (taskOid) {
        const result = await clientResult.client.listTaskComments(taskOid);
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

      // Re-check for TS narrowing (avoids non-null assertions).
      if (!projectId || taskId === undefined) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'taskOid' or both 'projectId' and 'taskId'",
            },
          ],
        };
      }

      const result = await clientResult.client.listTaskComments(
        projectId,
        taskId
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
      if (!taskOid && (!projectId || taskId === undefined)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'taskOid' or both 'projectId' and 'taskId'",
            },
          ],
        };
      }

      if (taskOid) {
        const result = await clientResult.client.addTaskComment(taskOid, {
          description,
        });
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

      // Re-check for TS narrowing (avoids non-null assertions).
      if (!projectId || taskId === undefined) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'taskOid' or both 'projectId' and 'taskId'",
            },
          ],
        };
      }

      const result = await clientResult.client.addTaskComment(
        projectId,
        taskId,
        {
          description,
        }
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

      const result = await clientResult.client.updateComment(oid, {
        description,
      });
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

      const result = await clientResult.client.deleteComment(oid);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Comment ${oid} deleted successfully.`,
          },
        ],
      };
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
      if (!chatOid && (!projectId || !chatId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'chatOid' or both 'projectId' and 'chatId'",
            },
          ],
        };
      }

      let result;
      if (chatOid) {
        result = await clientResult.client.listChatComments(chatOid);
      } else if (projectId && chatId) {
        result = await clientResult.client.listChatComments(projectId, chatId);
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
      if (!chatOid && (!projectId || !chatId)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'chatOid' or both 'projectId' and 'chatId'",
            },
          ],
        };
      }

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
}
