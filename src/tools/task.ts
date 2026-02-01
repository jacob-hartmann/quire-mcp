/**
 * Task Tools
 *
 * MCP tools for managing Quire tasks.
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
      errorMessage = "The requested task was not found.";
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
 * Register all task tools with the MCP server
 */
export function registerTaskTools(server: McpServer): void {
  // List Tasks
  server.registerTool(
    "quire.listTasks",
    {
      description:
        "List tasks in a project. Returns root-level tasks by default, " +
        "or subtasks if a parent task OID is provided.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        parentTaskOid: z
          .string()
          .optional()
          .describe(
            "Parent task OID to list subtasks of (optional). " +
              "If not provided, returns root-level tasks."
          ),
      }),
    },
    async ({ projectId, parentTaskOid }, extra) => {
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

      const result = await clientResult.client.listTasks(
        projectId,
        parentTaskOid
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

  // Get Task
  server.registerTool(
    "quire.getTask",
    {
      description:
        "Get detailed information about a specific task. " +
        "Can be retrieved by project ID + task ID, or by task OID alone.",
      inputSchema: z.object({
        projectId: z
          .string()
          .optional()
          .describe(
            "The project ID (required when using taskId, not needed when using oid)"
          ),
        taskId: z
          .number()
          .optional()
          .describe("The task ID number within the project"),
        oid: z
          .string()
          .optional()
          .describe(
            "The task OID (unique identifier). Use this OR projectId+taskId"
          ),
      }),
    },
    async ({ projectId, taskId, oid }, extra) => {
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
      if (!oid && (!projectId || taskId === undefined)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or both 'projectId' and 'taskId'",
            },
          ],
        };
      }

      const result = oid
        ? await clientResult.client.getTask(oid)
        : projectId && taskId !== undefined
          ? await clientResult.client.getTask(projectId, taskId)
          : (() => {
              // This should be unreachable because of the validation above.
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "Error: Must provide either 'oid' or both 'projectId' and 'taskId'",
                  },
                ],
              };
            })();

      if ("isError" in result) {
        return result;
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

  // Create Task
  server.registerTool(
    "quire.createTask",
    {
      description:
        "Create a new task in a project. The task name is required; " +
        "all other fields are optional.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID"),
        name: z.string().describe("The task name/title (required)"),
        description: z
          .string()
          .optional()
          .describe("Task description in markdown format"),
        priority: z
          .number()
          .min(-1)
          .max(2)
          .optional()
          .describe("Priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)"),
        status: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Status: 0 (to-do) to 100 (complete)"),
        due: z
          .string()
          .optional()
          .describe("Due date in ISO 8601 format (e.g., '2024-12-31')"),
        start: z
          .string()
          .optional()
          .describe("Start date in ISO 8601 format"),
        assignees: z
          .array(z.string())
          .optional()
          .describe("Array of user IDs to assign to this task"),
        tags: z.array(z.number()).optional().describe("Array of tag IDs"),
        parentOid: z
          .string()
          .optional()
          .describe("OID of parent task to create this as a subtask"),
        afterOid: z
          .string()
          .optional()
          .describe("OID of task to insert this task after"),
      }),
    },
    async (
      {
        projectId,
        name,
        description,
        priority,
        status,
        due,
        start,
        assignees,
        tags,
        parentOid,
        afterOid,
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
        name: string;
        description?: string;
        priority?: number;
        status?: number;
        due?: string;
        start?: string;
        assignees?: string[];
        tags?: number[];
        parentOid?: string;
        afterOid?: string;
      } = { name };
      if (description !== undefined) params.description = description;
      if (priority !== undefined) params.priority = priority;
      if (status !== undefined) params.status = status;
      if (due !== undefined) params.due = due;
      if (start !== undefined) params.start = start;
      if (assignees !== undefined) params.assignees = assignees;
      if (tags !== undefined) params.tags = tags;
      if (parentOid !== undefined) params.parentOid = parentOid;
      if (afterOid !== undefined) params.afterOid = afterOid;

      const result = await clientResult.client.createTask(projectId, params);
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

  // Update Task
  server.registerTool(
    "quire.updateTask",
    {
      description:
        "Update an existing task. Can be identified by project ID + task ID, " +
        "or by task OID alone. Only provided fields will be updated.",
      inputSchema: z.object({
        projectId: z
          .string()
          .optional()
          .describe(
            "The project ID (required when using taskId, not needed when using oid)"
          ),
        taskId: z
          .number()
          .optional()
          .describe("The task ID number within the project"),
        oid: z
          .string()
          .optional()
          .describe(
            "The task OID (unique identifier). Use this OR projectId+taskId"
          ),
        name: z.string().optional().describe("New task name/title"),
        description: z
          .string()
          .optional()
          .describe("New task description in markdown format"),
        priority: z
          .number()
          .min(-1)
          .max(2)
          .optional()
          .describe("Priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)"),
        status: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Status: 0 (to-do) to 100 (complete)"),
        due: z
          .string()
          .optional()
          .describe("Due date in ISO 8601 format (e.g., '2024-12-31')"),
        start: z
          .string()
          .optional()
          .describe("Start date in ISO 8601 format"),
        assignees: z
          .array(z.string())
          .optional()
          .describe("Replace all assignees with this list of user IDs"),
        addAssignees: z
          .array(z.string())
          .optional()
          .describe("User IDs to add as assignees"),
        removeAssignees: z
          .array(z.string())
          .optional()
          .describe("User IDs to remove from assignees"),
        tags: z
          .array(z.number())
          .optional()
          .describe("Replace all tags with this list of tag IDs"),
        addTags: z.array(z.number()).optional().describe("Tag IDs to add"),
        removeTags: z
          .array(z.number())
          .optional()
          .describe("Tag IDs to remove"),
      }),
    },
    async (
      {
        projectId,
        taskId,
        oid,
        name,
        description,
        priority,
        status,
        due,
        start,
        assignees,
        addAssignees,
        removeAssignees,
        tags,
        addTags,
        removeTags,
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
      if (!oid && (!projectId || taskId === undefined)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Error: Must provide either 'oid' or both 'projectId' and 'taskId'",
            },
          ],
        };
      }

      // Build update params, filtering out undefined values
      const updateParams: {
        name?: string;
        description?: string;
        priority?: number;
        status?: number;
        due?: string;
        start?: string;
        assignees?: string[];
        addAssignees?: string[];
        removeAssignees?: string[];
        tags?: number[];
        addTags?: number[];
        removeTags?: number[];
      } = {};
      if (name !== undefined) updateParams.name = name;
      if (description !== undefined) updateParams.description = description;
      if (priority !== undefined) updateParams.priority = priority;
      if (status !== undefined) updateParams.status = status;
      if (due !== undefined) updateParams.due = due;
      if (start !== undefined) updateParams.start = start;
      if (assignees !== undefined) updateParams.assignees = assignees;
      if (addAssignees !== undefined) updateParams.addAssignees = addAssignees;
      if (removeAssignees !== undefined) updateParams.removeAssignees = removeAssignees;
      if (tags !== undefined) updateParams.tags = tags;
      if (addTags !== undefined) updateParams.addTags = addTags;
      if (removeTags !== undefined) updateParams.removeTags = removeTags;

      const result = oid
        ? await clientResult.client.updateTask(oid, updateParams)
        : projectId && taskId !== undefined
          ? await clientResult.client.updateTask(projectId, taskId, updateParams)
          : (() => {
              // This should be unreachable because of the validation above.
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "Error: Must provide either 'oid' or both 'projectId' and 'taskId'",
                  },
                ],
              };
            })();

      if ("isError" in result) {
        return result;
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

  // Delete Task
  server.registerTool(
    "quire.deleteTask",
    {
      description:
        "Delete a task and all its subtasks. This action cannot be undone.",
      inputSchema: z.object({
        oid: z
          .string()
          .describe("The task OID (unique identifier) to delete"),
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

      const result = await clientResult.client.deleteTask(oid);
      if (!result.success) {
        return formatError(result.error);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Task ${oid} deleted successfully.`,
          },
        ],
      };
    }
  );

  // Search Tasks
  server.registerTool(
    "quire.searchTasks",
    {
      description:
        "Search for tasks in a project by keyword and optional filters. " +
        "Returns tasks matching the search criteria.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID (e.g., 'my-project') or OID to search in"),
        keyword: z
          .string()
          .describe("Search keyword to match against task names and descriptions"),
        status: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Filter by status: 0 (to-do) to 100 (complete)"),
        priority: z
          .number()
          .min(-1)
          .max(2)
          .optional()
          .describe(
            "Filter by priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)"
          ),
        assigneeId: z
          .string()
          .optional()
          .describe("Filter by assignee user ID"),
        tagId: z.number().optional().describe("Filter by tag ID"),
      }),
    },
    async ({ projectId, keyword, status, priority, assigneeId, tagId }, extra) => {
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

      // Build options, filtering out undefined values
      const options: {
        status?: number;
        priority?: number;
        assigneeId?: string;
        tagId?: number;
      } = {};
      if (status !== undefined) options.status = status;
      if (priority !== undefined) options.priority = priority;
      if (assigneeId !== undefined) options.assigneeId = assigneeId;
      if (tagId !== undefined) options.tagId = tagId;

      const result = await clientResult.client.searchTasks(projectId, keyword, options);
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

  // Create Task After
  server.registerTool(
    "quire.createTaskAfter",
    {
      description:
        "Create a new task immediately after a specified task. " +
        "The new task will be at the same level as the reference task.",
      inputSchema: z.object({
        taskOid: z
          .string()
          .describe("The OID of the task to insert after"),
        name: z.string().describe("The task name/title (required)"),
        description: z
          .string()
          .optional()
          .describe("Task description in markdown format"),
        priority: z
          .number()
          .min(-1)
          .max(2)
          .optional()
          .describe("Priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)"),
        status: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Status: 0 (to-do) to 100 (complete)"),
        due: z
          .string()
          .optional()
          .describe("Due date in ISO 8601 format (e.g., '2024-12-31')"),
        start: z
          .string()
          .optional()
          .describe("Start date in ISO 8601 format"),
        assignees: z
          .array(z.string())
          .optional()
          .describe("Array of user IDs to assign to this task"),
        tags: z.array(z.number()).optional().describe("Array of tag IDs"),
      }),
    },
    async (
      { taskOid, name, description, priority, status, due, start, assignees, tags },
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

      const params: {
        name: string;
        description?: string;
        priority?: number;
        status?: number;
        due?: string;
        start?: string;
        assignees?: string[];
        tags?: number[];
      } = { name };
      if (description !== undefined) params.description = description;
      if (priority !== undefined) params.priority = priority;
      if (status !== undefined) params.status = status;
      if (due !== undefined) params.due = due;
      if (start !== undefined) params.start = start;
      if (assignees !== undefined) params.assignees = assignees;
      if (tags !== undefined) params.tags = tags;

      const result = await clientResult.client.createTaskAfter(taskOid, params);
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

  // Create Task Before
  server.registerTool(
    "quire.createTaskBefore",
    {
      description:
        "Create a new task immediately before a specified task. " +
        "The new task will be at the same level as the reference task.",
      inputSchema: z.object({
        taskOid: z
          .string()
          .describe("The OID of the task to insert before"),
        name: z.string().describe("The task name/title (required)"),
        description: z
          .string()
          .optional()
          .describe("Task description in markdown format"),
        priority: z
          .number()
          .min(-1)
          .max(2)
          .optional()
          .describe("Priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)"),
        status: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Status: 0 (to-do) to 100 (complete)"),
        due: z
          .string()
          .optional()
          .describe("Due date in ISO 8601 format (e.g., '2024-12-31')"),
        start: z
          .string()
          .optional()
          .describe("Start date in ISO 8601 format"),
        assignees: z
          .array(z.string())
          .optional()
          .describe("Array of user IDs to assign to this task"),
        tags: z.array(z.number()).optional().describe("Array of tag IDs"),
      }),
    },
    async (
      { taskOid, name, description, priority, status, due, start, assignees, tags },
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

      const params: {
        name: string;
        description?: string;
        priority?: number;
        status?: number;
        due?: string;
        start?: string;
        assignees?: string[];
        tags?: number[];
      } = { name };
      if (description !== undefined) params.description = description;
      if (priority !== undefined) params.priority = priority;
      if (status !== undefined) params.status = status;
      if (due !== undefined) params.due = due;
      if (start !== undefined) params.start = start;
      if (assignees !== undefined) params.assignees = assignees;
      if (tags !== undefined) params.tags = tags;

      const result = await clientResult.client.createTaskBefore(taskOid, params);
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

  // Search Folder Tasks
  server.registerTool(
    "quire.searchFolderTasks",
    {
      description:
        "Search for tasks within a specific folder by keyword and optional filters.",
      inputSchema: z.object({
        folderOid: z
          .string()
          .describe("The folder OID to search in"),
        keyword: z
          .string()
          .describe("Search keyword to match against task names and descriptions"),
        status: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Filter by status: 0 (to-do) to 100 (complete)"),
        priority: z
          .number()
          .min(-1)
          .max(2)
          .optional()
          .describe("Filter by priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)"),
        assigneeId: z
          .string()
          .optional()
          .describe("Filter by assignee user ID"),
        tagId: z.number().optional().describe("Filter by tag ID"),
      }),
    },
    async ({ folderOid, keyword, status, priority, assigneeId, tagId }, extra) => {
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

      const options: {
        status?: number;
        priority?: number;
        assigneeId?: string;
        tagId?: number;
      } = {};
      if (status !== undefined) options.status = status;
      if (priority !== undefined) options.priority = priority;
      if (assigneeId !== undefined) options.assigneeId = assigneeId;
      if (tagId !== undefined) options.tagId = tagId;

      const result = await clientResult.client.searchFolderTasks(
        folderOid,
        keyword,
        options
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

  // Search Organization Tasks
  server.registerTool(
    "quire.searchOrganizationTasks",
    {
      description:
        "Search for tasks across an entire organization by keyword and optional filters. " +
        "This searches all projects within the organization.",
      inputSchema: z.object({
        organizationId: z
          .string()
          .describe("The organization ID (e.g., 'my-org') or OID to search in"),
        keyword: z
          .string()
          .describe("Search keyword to match against task names and descriptions"),
        status: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Filter by status: 0 (to-do) to 100 (complete)"),
        priority: z
          .number()
          .min(-1)
          .max(2)
          .optional()
          .describe("Filter by priority: -1 (low), 0 (medium), 1 (high), 2 (urgent)"),
        assigneeId: z
          .string()
          .optional()
          .describe("Filter by assignee user ID"),
        tagId: z.number().optional().describe("Filter by tag ID"),
      }),
    },
    async ({ organizationId, keyword, status, priority, assigneeId, tagId }, extra) => {
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

      const options: {
        status?: number;
        priority?: number;
        assigneeId?: string;
        tagId?: number;
      } = {};
      if (status !== undefined) options.status = status;
      if (priority !== undefined) options.priority = priority;
      if (assigneeId !== undefined) options.assigneeId = assigneeId;
      if (tagId !== undefined) options.tagId = tagId;

      const result = await clientResult.client.searchOrganizationTasks(
        organizationId,
        keyword,
        options
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
