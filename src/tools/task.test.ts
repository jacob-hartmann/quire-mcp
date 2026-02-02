import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskTools } from "./task.js";
import {
  createMockExtra,
  createMockClient,
  mockErrors,
  extractTextContent,
  isErrorResponse,
} from "./__test-utils__.js";
import type { QuireClientResult } from "../quire/client-factory.js";

vi.mock("../quire/client-factory.js", () => ({
  getQuireClient: vi.fn(),
}));

import { getQuireClient } from "../quire/client-factory.js";

describe("Task Tools", () => {
  let server: McpServer;
  let registeredTools: Map<
    string,
    {
      description: string;
      handler: (
        params: Record<string, unknown>,
        extra: unknown
      ) => Promise<unknown>;
    }
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    registeredTools = new Map();
    server = {
      registerTool: vi.fn(
        (
          name: string,
          config: { description: string },
          handler: (
            params: Record<string, unknown>,
            extra: unknown
          ) => Promise<unknown>
        ) => {
          registeredTools.set(name, { description: config.description, handler });
        }
      ),
    } as unknown as McpServer;

    registerTaskTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all task tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(10);
    expect(registeredTools.has("quire.listTasks")).toBe(true);
    expect(registeredTools.has("quire.getTask")).toBe(true);
    expect(registeredTools.has("quire.createTask")).toBe(true);
    expect(registeredTools.has("quire.updateTask")).toBe(true);
    expect(registeredTools.has("quire.deleteTask")).toBe(true);
    expect(registeredTools.has("quire.searchTasks")).toBe(true);
    expect(registeredTools.has("quire.createTaskAfter")).toBe(true);
    expect(registeredTools.has("quire.createTaskBefore")).toBe(true);
    expect(registeredTools.has("quire.searchFolderTasks")).toBe(true);
    expect(registeredTools.has("quire.searchOrganizationTasks")).toBe(true);
  });

  describe("quire.listTasks", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listTasks")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should list root tasks", async () => {
      const mockTasks = [
        { oid: "task1", id: 1, name: "Task 1" },
        { oid: "task2", id: 2, name: "Task 2" },
      ];
      const mockClient = createMockClient({
        listTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTasks,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTasks")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("Task 1");
      expect(mockClient.listTasks).toHaveBeenCalledWith("my-project", undefined);
    });

    it("should list subtasks when parentTaskOid provided", async () => {
      const mockClient = createMockClient({
        listTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTasks")!;
      await tool.handler(
        { projectId: "my-project", parentTaskOid: "ParentOid" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.listTasks).toHaveBeenCalledWith(
        "my-project",
        "ParentOid"
      );
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        listTasks: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTasks")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.getTask", () => {
    it("should get task by OID", async () => {
      const mockTask = { oid: "TaskOid", id: 1, name: "Task 1" };
      const mockClient = createMockClient({
        getTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTask,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getTask")!;
      const result = (await tool.handler(
        { oid: "TaskOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("Task 1");
      expect(mockClient.getTask).toHaveBeenCalledWith("TaskOid");
    });

    it("should get task by project ID and task ID", async () => {
      const mockTask = { oid: "TaskOid", id: 123, name: "Task 123" };
      const mockClient = createMockClient({
        getTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTask,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getTask")!;
      const result = (await tool.handler(
        { projectId: "my-project", taskId: 123 },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.getTask).toHaveBeenCalledWith("my-project", 123);
    });

    it("should return error when neither OID nor projectId+taskId provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getTask")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain(
        "Must provide either 'oid' or both 'projectId' and 'taskId'"
      );
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getTask: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getTask")!;
      const result = (await tool.handler(
        { oid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
      expect(extractTextContent(result)).toContain("task was not found");
    });
  });

  describe("quire.createTask", () => {
    it("should create task with minimal params", async () => {
      const mockTask = { oid: "NewTask", id: 1, name: "New Task" };
      const mockClient = createMockClient({
        createTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTask,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTask")!;
      const result = (await tool.handler(
        { projectId: "my-project", name: "New Task" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createTask).toHaveBeenCalledWith("my-project", {
        name: "New Task",
      });
    });

    it("should create task with all params", async () => {
      const mockClient = createMockClient({
        createTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "NewTask", id: 1, name: "Task" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTask")!;
      await tool.handler(
        {
          projectId: "my-project",
          name: "Task",
          description: "Description",
          priority: 1,
          status: 50,
          due: "2024-12-31",
          start: "2024-12-01",
          assignees: ["user1"],
          tags: [1, 2],
          parentOid: "ParentOid",
          afterOid: "AfterOid",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createTask).toHaveBeenCalledWith("my-project", {
        name: "Task",
        description: "Description",
        priority: 1,
        status: 50,
        due: "2024-12-31",
        start: "2024-12-01",
        assignees: ["user1"],
        tags: [1, 2],
        parentOid: "ParentOid",
        afterOid: "AfterOid",
      });
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        createTask: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTask")!;
      const result = (await tool.handler(
        { projectId: "my-project", name: "Task" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });
  });

  describe("quire.updateTask", () => {
    it("should update task by OID", async () => {
      const mockClient = createMockClient({
        updateTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "TaskOid", id: 1, name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateTask")!;
      await tool.handler(
        { oid: "TaskOid", name: "Updated" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateTask).toHaveBeenCalledWith("TaskOid", {
        name: "Updated",
      });
    });

    it("should update task by project ID and task ID", async () => {
      const mockClient = createMockClient({
        updateTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "TaskOid", id: 123, name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateTask")!;
      await tool.handler(
        { projectId: "my-project", taskId: 123, name: "Updated" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateTask).toHaveBeenCalledWith("my-project", 123, {
        name: "Updated",
      });
    });

    it("should handle all update params", async () => {
      const mockClient = createMockClient({
        updateTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "TaskOid", id: 1, name: "Task" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateTask")!;
      await tool.handler(
        {
          oid: "TaskOid",
          name: "Task",
          description: "Desc",
          priority: 2,
          status: 100,
          due: "2024-12-31",
          start: "2024-12-01",
          assignees: ["user1"],
          addAssignees: ["user2"],
          removeAssignees: ["user3"],
          tags: [1],
          addTags: [2],
          removeTags: [3],
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateTask).toHaveBeenCalledWith("TaskOid", {
        name: "Task",
        description: "Desc",
        priority: 2,
        status: 100,
        due: "2024-12-31",
        start: "2024-12-01",
        assignees: ["user1"],
        addAssignees: ["user2"],
        removeAssignees: ["user3"],
        tags: [1],
        addTags: [2],
        removeTags: [3],
      });
    });

    it("should return error when neither OID nor projectId+taskId provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateTask")!;
      const result = (await tool.handler(
        { name: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain(
        "Must provide either 'oid' or both 'projectId' and 'taskId'"
      );
    });
  });

  describe("quire.deleteTask", () => {
    it("should delete task by OID", async () => {
      const mockClient = createMockClient({
        deleteTask: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "TaskOid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteTask")!;
      const result = (await tool.handler(
        { oid: "TaskOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteTask).toHaveBeenCalledWith("TaskOid");
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        deleteTask: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteTask")!;
      const result = (await tool.handler(
        { oid: "TaskOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.searchTasks", () => {
    it("should search tasks with keyword only", async () => {
      const mockClient = createMockClient({
        searchTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [{ oid: "task1", id: 1, name: "Bug fix" }],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.searchTasks")!;
      const result = (await tool.handler(
        { projectId: "my-project", keyword: "bug" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.searchTasks).toHaveBeenCalledWith(
        "my-project",
        "bug",
        {}
      );
    });

    it("should search with all filters", async () => {
      const mockClient = createMockClient({
        searchTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.searchTasks")!;
      await tool.handler(
        {
          projectId: "my-project",
          keyword: "feature",
          status: 50,
          priority: 1,
          assigneeId: "user1",
          tagId: 5,
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.searchTasks).toHaveBeenCalledWith(
        "my-project",
        "feature",
        {
          status: 50,
          priority: 1,
          assigneeId: "user1",
          tagId: 5,
        }
      );
    });
  });

  describe("quire.createTaskAfter", () => {
    it("should create task after specified task", async () => {
      const mockClient = createMockClient({
        createTaskAfter: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "NewTask", id: 2, name: "After Task" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTaskAfter")!;
      const result = (await tool.handler(
        { taskOid: "ExistingTaskOid", name: "After Task" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createTaskAfter).toHaveBeenCalledWith(
        "ExistingTaskOid",
        { name: "After Task" }
      );
    });

    it("should include all optional params", async () => {
      const mockClient = createMockClient({
        createTaskAfter: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "NewTask", id: 2, name: "Task" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTaskAfter")!;
      await tool.handler(
        {
          taskOid: "TaskOid",
          name: "Task",
          description: "Desc",
          priority: 1,
          status: 0,
          due: "2024-12-31",
          start: "2024-12-01",
          assignees: ["user1"],
          tags: [1, 2],
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createTaskAfter).toHaveBeenCalledWith("TaskOid", {
        name: "Task",
        description: "Desc",
        priority: 1,
        status: 0,
        due: "2024-12-31",
        start: "2024-12-01",
        assignees: ["user1"],
        tags: [1, 2],
      });
    });
  });

  describe("quire.createTaskBefore", () => {
    it("should create task before specified task", async () => {
      const mockClient = createMockClient({
        createTaskBefore: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "NewTask", id: 0, name: "Before Task" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTaskBefore")!;
      const result = (await tool.handler(
        { taskOid: "ExistingTaskOid", name: "Before Task" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createTaskBefore).toHaveBeenCalledWith(
        "ExistingTaskOid",
        { name: "Before Task" }
      );
    });
  });

  describe("quire.searchFolderTasks", () => {
    it("should search tasks in folder", async () => {
      const mockClient = createMockClient({
        searchFolderTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.searchFolderTasks")!;
      await tool.handler(
        { folderId: "my-folder", keyword: "bug" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.searchFolderTasks).toHaveBeenCalledWith(
        "my-folder",
        "bug",
        {}
      );
    });

    it("should include search filters", async () => {
      const mockClient = createMockClient({
        searchFolderTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.searchFolderTasks")!;
      await tool.handler(
        {
          folderId: "my-folder",
          keyword: "feature",
          status: 0,
          priority: 2,
          assigneeId: "user1",
          tagId: 1,
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.searchFolderTasks).toHaveBeenCalledWith(
        "my-folder",
        "feature",
        {
          status: 0,
          priority: 2,
          assigneeId: "user1",
          tagId: 1,
        }
      );
    });
  });

  describe("quire.searchOrganizationTasks", () => {
    it("should search tasks in organization", async () => {
      const mockClient = createMockClient({
        searchOrganizationTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.searchOrganizationTasks")!;
      await tool.handler(
        { organizationId: "my-org", keyword: "urgent" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.searchOrganizationTasks).toHaveBeenCalledWith(
        "my-org",
        "urgent",
        {}
      );
    });

    it("should include search filters", async () => {
      const mockClient = createMockClient({
        searchOrganizationTasks: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.searchOrganizationTasks")!;
      await tool.handler(
        {
          organizationId: "my-org",
          keyword: "review",
          status: 100,
          priority: 0,
          assigneeId: "user2",
          tagId: 3,
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.searchOrganizationTasks).toHaveBeenCalledWith(
        "my-org",
        "review",
        {
          status: 100,
          priority: 0,
          assigneeId: "user2",
          tagId: 3,
        }
      );
    });
  });
});
