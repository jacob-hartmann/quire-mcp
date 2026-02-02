import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./project.js";
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

describe("Project Tools", () => {
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

    registerProjectTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all project tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(4);
    expect(registeredTools.has("quire.listProjects")).toBe(true);
    expect(registeredTools.has("quire.getProject")).toBe(true);
    expect(registeredTools.has("quire.updateProject")).toBe(true);
    expect(registeredTools.has("quire.exportProject")).toBe(true);
  });

  describe("quire.listProjects", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listProjects")!;
      const result = (await tool.handler({}, createMockExtra())) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should list all projects", async () => {
      const mockProjects = [
        { oid: "proj1", id: "project-1", name: "Project 1" },
        { oid: "proj2", id: "project-2", name: "Project 2" },
      ];
      const mockClient = createMockClient({
        listProjects: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockProjects,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listProjects")!;
      const result = (await tool.handler(
        {},
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("project-1");
      expect(mockClient.listProjects).toHaveBeenCalledWith(undefined);
    });

    it("should filter by organization ID", async () => {
      const mockClient = createMockClient({
        listProjects: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listProjects")!;
      await tool.handler(
        { organizationId: "my-org" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.listProjects).toHaveBeenCalledWith("my-org");
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        listProjects: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listProjects")!;
      const result = (await tool.handler(
        {},
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.getProject", () => {
    it("should get project by ID", async () => {
      const mockProject = {
        oid: "proj-oid",
        id: "my-project",
        name: "My Project",
        nameText: "My Project",
      };
      const mockClient = createMockClient({
        getProject: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockProject,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getProject")!;
      const result = (await tool.handler(
        { id: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("my-project");
      expect(mockClient.getProject).toHaveBeenCalledWith("my-project");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getProject: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getProject")!;
      const result = (await tool.handler(
        { id: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.updateProject", () => {
    it("should update project", async () => {
      const mockProject = {
        oid: "proj-oid",
        id: "my-project",
        name: "Updated Project",
      };
      const mockClient = createMockClient({
        updateProject: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockProject,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateProject")!;
      const result = (await tool.handler(
        { id: "my-project", name: "Updated Project", description: "New desc" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.updateProject).toHaveBeenCalledWith("my-project", {
        name: "Updated Project",
        description: "New desc",
      });
    });

    it("should handle follower updates", async () => {
      const mockClient = createMockClient({
        updateProject: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "proj-oid", id: "my-project", name: "Project" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateProject")!;
      await tool.handler(
        {
          id: "my-project",
          addFollowers: ["user1"],
          removeFollowers: ["user2"],
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateProject).toHaveBeenCalledWith("my-project", {
        addFollowers: ["user1"],
        removeFollowers: ["user2"],
      });
    });

    it("should handle FORBIDDEN error", async () => {
      const mockClient = createMockClient({
        updateProject: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateProject")!;
      const result = (await tool.handler(
        { id: "my-project", name: "New" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });
  });

  describe("quire.exportProject", () => {
    it("should export project as JSON by default", async () => {
      const mockTasks = [
        { oid: "task1", id: 1, name: "Task 1" },
        { oid: "task2", id: 2, name: "Task 2" },
      ];
      const mockClient = createMockClient({
        exportProject: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTasks,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.exportProject")!;
      const result = (await tool.handler(
        { id: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("Task 1");
      expect(mockClient.exportProject).toHaveBeenCalledWith(
        "my-project",
        undefined
      );
    });

    it("should export project as CSV", async () => {
      const csvData = "id,name\n1,Task 1\n2,Task 2";
      const mockClient = createMockClient({
        exportProject: vi.fn().mockResolvedValueOnce({
          success: true,
          data: csvData,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.exportProject")!;
      const result = (await tool.handler(
        { id: "my-project", format: "csv" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("id,name");
      expect(mockClient.exportProject).toHaveBeenCalledWith("my-project", "csv");
    });

    it("should handle export errors", async () => {
      const mockClient = createMockClient({
        exportProject: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.exportProject")!;
      const result = (await tool.handler(
        { id: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });
});
