/**
 * Attachment Tools
 *
 * MCP tools for uploading file attachments to Quire tasks and comments.
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
        "Your access token does not have permission to upload attachments.";
      break;
    case "NOT_FOUND":
      errorMessage = "The requested task or comment was not found.";
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
 * Register all attachment tools with the MCP server
 */
export function registerAttachmentTools(server: McpServer): void {
  // Upload Task Attachment
  server.registerTool(
    "quire.uploadTaskAttachment",
    {
      description:
        "Upload a file attachment to a task. " +
        "The content should be provided as a string (e.g., text content or base64-encoded binary).",
      inputSchema: z.object({
        taskOid: z
          .string()
          .describe("The task OID (unique identifier) to attach the file to"),
        filename: z
          .string()
          .describe("The filename for the attachment (e.g., 'document.txt')"),
        content: z.string().describe("The file content as a string"),
        mimeType: z
          .string()
          .optional()
          .describe(
            "The MIME type of the file (e.g., 'text/plain', 'application/pdf'). " +
              "Defaults to 'application/octet-stream'"
          ),
      }),
    },
    async ({ taskOid, filename, content, mimeType }, extra) => {
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

      const result = await clientResult.client.uploadTaskAttachment(
        taskOid,
        filename,
        content,
        mimeType
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

  // Upload Comment Attachment
  server.registerTool(
    "quire.uploadCommentAttachment",
    {
      description:
        "Upload a file attachment to a comment. " +
        "The content should be provided as a string (e.g., text content or base64-encoded binary).",
      inputSchema: z.object({
        commentOid: z
          .string()
          .describe(
            "The comment OID (unique identifier) to attach the file to"
          ),
        filename: z
          .string()
          .describe("The filename for the attachment (e.g., 'document.txt')"),
        content: z.string().describe("The file content as a string"),
        mimeType: z
          .string()
          .optional()
          .describe(
            "The MIME type of the file (e.g., 'text/plain', 'application/pdf'). " +
              "Defaults to 'application/octet-stream'"
          ),
      }),
    },
    async ({ commentOid, filename, content, mimeType }, extra) => {
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

      const result = await clientResult.client.uploadCommentAttachment(
        commentOid,
        filename,
        content,
        mimeType
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
}
