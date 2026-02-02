/**
 * Task Tools
 *
 * MCP tools for managing Quire tasks.
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
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.listTasks(
        projectId,
        parentTaskOid
      );
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
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
        return formatAuthError(clientResult.error);
      }

      // Get task by OID or by projectId + taskId
      let result;
      if (oid) {
        result = await clientResult.client.getTask(oid);
      } else if (projectId && taskId !== undefined) {
        result = await clientResult.client.getTask(projectId, taskId);
      } else {
        return formatValidationError(
          "Must provide either 'oid' or both 'projectId' and 'taskId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
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
        start: z.string().optional().describe("Start date in ISO 8601 format"),
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
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
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
      });

      const result = await clientResult.client.createTask(
        projectId,
        params as { name: string }
      );
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
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
        start: z.string().optional().describe("Start date in ISO 8601 format"),
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
        return formatAuthError(clientResult.error);
      }

      const updateParams = buildParams({
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
      });

      // Update task by OID or by projectId + taskId
      let result;
      if (oid) {
        result = await clientResult.client.updateTask(oid, updateParams);
      } else if (projectId && taskId !== undefined) {
        result = await clientResult.client.updateTask(projectId, taskId, updateParams);
      } else {
        return formatValidationError(
          "Must provide either 'oid' or both 'projectId' and 'taskId'"
        );
      }

      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
    }
  );

  // Delete Task
  server.registerTool(
    "quire.deleteTask",
    {
      description:
        "Delete a task and all its subtasks. This action cannot be undone.",
      inputSchema: z.object({
        oid: z.string().describe("The task OID (unique identifier) to delete"),
      }),
    },
    async ({ oid }, extra) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const result = await clientResult.client.deleteTask(oid);
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatMessage(`Task ${oid} deleted successfully.`);
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
          .describe(
            "Search keyword to match against task names and descriptions"
          ),
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
    async (
      { projectId, keyword, status, priority, assigneeId, tagId },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const options = buildParams({ status, priority, assigneeId, tagId });

      const result = await clientResult.client.searchTasks(
        projectId,
        keyword,
        options
      );
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
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
        taskOid: z.string().describe("The OID of the task to insert after"),
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
        start: z.string().optional().describe("Start date in ISO 8601 format"),
        assignees: z
          .array(z.string())
          .optional()
          .describe("Array of user IDs to assign to this task"),
        tags: z.array(z.number()).optional().describe("Array of tag IDs"),
      }),
    },
    async (
      {
        taskOid,
        name,
        description,
        priority,
        status,
        due,
        start,
        assignees,
        tags,
      },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
        name,
        description,
        priority,
        status,
        due,
        start,
        assignees,
        tags,
      });

      const result = await clientResult.client.createTaskAfter(
        taskOid,
        params as { name: string }
      );
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
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
        taskOid: z.string().describe("The OID of the task to insert before"),
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
        start: z.string().optional().describe("Start date in ISO 8601 format"),
        assignees: z
          .array(z.string())
          .optional()
          .describe("Array of user IDs to assign to this task"),
        tags: z.array(z.number()).optional().describe("Array of tag IDs"),
      }),
    },
    async (
      {
        taskOid,
        name,
        description,
        priority,
        status,
        due,
        start,
        assignees,
        tags,
      },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const params = buildParams({
        name,
        description,
        priority,
        status,
        due,
        start,
        assignees,
        tags,
      });

      const result = await clientResult.client.createTaskBefore(
        taskOid,
        params as { name: string }
      );
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
    }
  );

  // Search Folder Tasks
  server.registerTool(
    "quire.searchFolderTasks",
    {
      description:
        "Search for tasks within a specific folder by keyword and optional filters.",
      inputSchema: z.object({
        folderId: z
          .string()
          .describe("The folder ID (e.g., 'my-folder') or OID to search in"),
        keyword: z
          .string()
          .describe(
            "Search keyword to match against task names and descriptions"
          ),
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
    async (
      { folderId, keyword, status, priority, assigneeId, tagId },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const options = buildParams({ status, priority, assigneeId, tagId });

      const result = await clientResult.client.searchFolderTasks(
        folderId,
        keyword,
        options
      );
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
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
          .describe(
            "Search keyword to match against task names and descriptions"
          ),
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
    async (
      { organizationId, keyword, status, priority, assigneeId, tagId },
      extra
    ) => {
      const clientResult = await getQuireClient(extra);
      if (!clientResult.success) {
        return formatAuthError(clientResult.error);
      }

      const options = buildParams({ status, priority, assigneeId, tagId });

      const result = await clientResult.client.searchOrganizationTasks(
        organizationId,
        keyword,
        options
      );
      if (!result.success) {
        return formatError(result.error, "task");
      }

      return formatSuccess(result.data);
    }
  );
}
