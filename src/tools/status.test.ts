import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStatusTools } from "./status.js";
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

describe("Status Tools", () => {
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
          registeredTools.set(name, {
            description: config.description,
            handler,
          });
        }
      ),
    } as unknown as McpServer;

    registerStatusTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all status tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(5);
    expect(registeredTools.has("quire.listStatuses")).toBe(true);
    expect(registeredTools.has("quire.getStatus")).toBe(true);
    expect(registeredTools.has("quire.createStatus")).toBe(true);
    expect(registeredTools.has("quire.updateStatus")).toBe(true);
    expect(registeredTools.has("quire.deleteStatus")).toBe(true);
  });

  describe("quire.listStatuses", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listStatuses");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should list statuses in project", async () => {
      const mockStatuses = [
        { value: 0, name: "To Do" },
        { value: 50, name: "In Progress" },
        { value: 100, name: "Done" },
      ];
      const mockClient = createMockClient({
        listStatuses: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockStatuses,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listStatuses");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("To Do");
      expect(extractTextContent(result)).toContain("In Progress");
      expect(mockClient.listStatuses).toHaveBeenCalledWith("my-project");
    });
  });

  describe("quire.getStatus", () => {
    it("should get status by project and value", async () => {
      const mockStatus = { value: 50, name: "In Progress", color: 1 };
      const mockClient = createMockClient({
        getStatus: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockStatus,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 50 },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("In Progress");
      expect(mockClient.getStatus).toHaveBeenCalledWith("my-project", 50);
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getStatus: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 999 },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.createStatus", () => {
    it("should create status with required params", async () => {
      const mockStatus = { value: 25, name: "Review" };
      const mockClient = createMockClient({
        createStatus: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockStatus,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", name: "Review" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createStatus).toHaveBeenCalledWith("my-project", {
        name: "Review",
      });
    });

    it("should create status with optional color", async () => {
      const mockClient = createMockClient({
        createStatus: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { value: 25, name: "Review", color: "ff5733" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { projectId: "my-project", name: "Review", color: "ff5733" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createStatus).toHaveBeenCalledWith("my-project", {
        name: "Review",
        color: "ff5733",
      });
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        createStatus: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", name: "Status" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.updateStatus", () => {
    it("should update status", async () => {
      const mockStatus = { value: 50, name: "Working", color: 2 };
      const mockClient = createMockClient({
        updateStatus: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockStatus,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 50, name: "Working", color: 2 },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.updateStatus).toHaveBeenCalledWith("my-project", 50, {
        name: "Working",
        color: 2,
      });
    });
  });

  describe("quire.deleteStatus", () => {
    it("should delete status", async () => {
      const mockClient = createMockClient({
        deleteStatus: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { value: 50 },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 50 },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteStatus).toHaveBeenCalledWith("my-project", 50);
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        deleteStatus: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 999 },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("authentication failures", () => {
    it("should return auth error for getStatus", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.getStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 50 },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for createStatus", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.createStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", name: "Status" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for updateStatus", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.updateStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 50, name: "Updated" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for deleteStatus", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.deleteStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 50 },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });
  });

  describe("API error handling", () => {
    it("should handle listStatuses API error", async () => {
      const mockClient = createMockClient({
        listStatuses: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listStatuses");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle updateStatus API error", async () => {
      const mockClient = createMockClient({
        updateStatus: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateStatus");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { projectId: "my-project", value: 50, name: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });
  });
});
