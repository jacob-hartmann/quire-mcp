/**
 * Notification Tools
 *
 * MCP tools for sending Quire notifications.
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
        "Your access token does not have permission to send notifications.";
      break;
    case "NOT_FOUND":
      errorMessage = "One or more specified users were not found.";
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
 * Register all notification tools with the MCP server
 */
export function registerNotificationTools(server: McpServer): void {
  // Send Notification
  server.registerTool(
    "quire.sendNotification",
    {
      description:
        "Send a notification to one or more Quire users. " +
        "Optionally include a URL that users can click to navigate to.",
      inputSchema: z.object({
        userIds: z
          .array(z.string())
          .min(1)
          .describe("Array of user IDs to send the notification to"),
        message: z
          .string()
          .describe("The notification message text"),
        url: z
          .string()
          .optional()
          .describe("Optional URL to include in the notification"),
      }),
    },
    async ({ userIds, message, url }, extra) => {
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

      const params: { userIds: string[]; message: string; url?: string } = {
        userIds,
        message,
      };
      if (url !== undefined) params.url = url;

      const result = await clientResult.client.sendNotification(params);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Notification sent successfully to ${userIds.length} user(s).`,
          },
        ],
      };
    }
  );
}
