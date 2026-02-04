import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUserTools } from "./user.js";
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

describe("User Tools", () => {
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

    registerUserTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all user tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(3);
    expect(registeredTools.has("quire.getUser")).toBe(true);
    expect(registeredTools.has("quire.listUsers")).toBe(true);
    expect(registeredTools.has("quire.listProjectMembers")).toBe(true);
  });

  describe("quire.getUser", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.getUser");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool should be defined");

      const result = (await tool.handler(
        { id: "john_doe" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should get user by ID", async () => {
      const mockUser = {
        oid: "user-oid",
        id: "john_doe",
        name: "John Doe",
        nameText: "John Doe",
        email: "john@example.com",
      };
      const mockClient = createMockClient({
        getUser: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockUser,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getUser");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool should be defined");

      const result = (await tool.handler(
        { id: "john_doe" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("john_doe");
      expect(extractTextContent(result)).toContain("John Doe");
      expect(mockClient.getUser).toHaveBeenCalledWith("john_doe");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getUser: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getUser");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool should be defined");

      const result = (await tool.handler(
        { id: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.listUsers", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listUsers");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool should be defined");

      const result = (await tool.handler({}, createMockExtra())) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should list all users", async () => {
      const mockUsers = [
        { oid: "user1", id: "john", name: "John" },
        { oid: "user2", id: "jane", name: "Jane" },
      ];
      const mockClient = createMockClient({
        listUsers: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockUsers,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listUsers");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool should be defined");

      const result = (await tool.handler(
        {},
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("john");
      expect(extractTextContent(result)).toContain("jane");
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        listUsers: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listUsers");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool should be defined");

      const result = (await tool.handler(
        {},
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.listProjectMembers", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listProjectMembers");
      expect(tool).toBeDefined();
      if (!tool) throw new Error("Tool should be defined");

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

    it("should list project members", async () => {
      const mockMembers = [
        { oid: "user1", id: "john", name: "John" },
        { oid: "user2", id: "jane", name: "Jane" },
      ];
      const mockClient = createMockClient({
        listProjectMembers: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockMembers,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listProjectMembers")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("john");
      expect(mockClient.listProjectMembers).toHaveBeenCalledWith("my-project");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        listProjectMembers: vi
          .fn()
          .mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listProjectMembers")!;
      const result = (await tool.handler(
        { projectId: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });
});
