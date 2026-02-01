/**
 * Project Tools
 *
 * MCP tools for managing Quire projects.
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
      errorMessage = "The requested project was not found.";
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
 * Register all project tools with the MCP server
 */
export function registerProjectTools(server: McpServer): void {
  // List Projects
  server.registerTool(
    "quire.listProjects",
    {
      description:
        "List all projects accessible to the current user. " +
        "Optionally filter by organization.",
      inputSchema: z.object({
        organizationId: z
          .string()
          .optional()
          .describe(
            "Filter projects by organization ID or OID (optional). " +
              "If not provided, returns all accessible projects."
          ),
      }),
    },
    async ({ organizationId }, extra) => {
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

      const result = await clientResult.client.listProjects(organizationId);
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

  // Get Project
  server.registerTool(
    "quire.getProject",
    {
      description:
        "Get detailed information about a specific project by its ID or OID. " +
        "Returns full project details including task counts, organization, and owner.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') or OID (unique identifier)"
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

      const result = await clientResult.client.getProject(id);
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

  // Update Project
  server.registerTool(
    "quire.updateProject",
    {
      description:
        "Update a project's settings including name, description, icon, and followers.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') or OID (unique identifier)"
          ),
        name: z.string().optional().describe("New name for the project"),
        description: z
          .string()
          .optional()
          .describe("New description for the project"),
        icon: z
          .string()
          .optional()
          .describe("Icon identifier for the project"),
        iconColor: z
          .string()
          .optional()
          .describe("Icon color (hex code without #)"),
        archived: z
          .boolean()
          .optional()
          .describe("Whether the project is archived"),
        followers: z
          .array(z.string())
          .optional()
          .describe("Replace all followers with this list of user IDs"),
        addFollowers: z
          .array(z.string())
          .optional()
          .describe("User IDs to add as followers"),
        removeFollowers: z
          .array(z.string())
          .optional()
          .describe("User IDs to remove from followers"),
      }),
    },
    async (
      {
        id,
        name,
        description,
        icon,
        iconColor,
        archived,
        followers,
        addFollowers,
        removeFollowers,
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

      // Build params object, filtering out undefined values
      const params: {
        name?: string;
        description?: string;
        icon?: string;
        iconColor?: string;
        archived?: boolean;
        followers?: string[];
        addFollowers?: string[];
        removeFollowers?: string[];
      } = {};
      if (name !== undefined) params.name = name;
      if (description !== undefined) params.description = description;
      if (icon !== undefined) params.icon = icon;
      if (iconColor !== undefined) params.iconColor = iconColor;
      if (archived !== undefined) params.archived = archived;
      if (followers !== undefined) params.followers = followers;
      if (addFollowers !== undefined) params.addFollowers = addFollowers;
      if (removeFollowers !== undefined) params.removeFollowers = removeFollowers;

      const result = await clientResult.client.updateProject(id, params);
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

  // Export Project
  server.registerTool(
    "quire.exportProject",
    {
      description:
        "Export all tasks from a project in JSON or CSV format. " +
        "Useful for backups, analysis, or integrations.",
      inputSchema: z.object({
        id: z
          .string()
          .describe(
            "The project ID (e.g., 'my-project') or OID (unique identifier)"
          ),
        format: z
          .enum(["json", "csv"])
          .default("json")
          .describe("Export format: 'json' (default) or 'csv'"),
      }),
    },
    async ({ id, format }, extra) => {
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

      const result = await clientResult.client.exportProject(id, format);
      if (!result.success) {
        return formatError(result.error);
      }

      // Format output based on export type
      const output =
        format === "csv"
          ? (result.data as string)
          : JSON.stringify(result.data, null, 2);

      return {
        content: [
          {
            type: "text" as const,
            text: output,
          },
        ],
      };
    }
  );
}
