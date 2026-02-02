import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTagTools } from "./tag.js";
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

describe("Tag Tools", () => {
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

    registerTagTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all tag tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(5);
    expect(registeredTools.has("quire.listTags")).toBe(true);
    expect(registeredTools.has("quire.getTag")).toBe(true);
    expect(registeredTools.has("quire.createTag")).toBe(true);
    expect(registeredTools.has("quire.updateTag")).toBe(true);
    expect(registeredTools.has("quire.deleteTag")).toBe(true);
  });

  describe("quire.listTags", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listTags")!;
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

    it("should list tags in project", async () => {
      const mockTags = [
        { oid: "tag1", id: 1, name: "Bug" },
        { oid: "tag2", id: 2, name: "Feature" },
      ];
      const mockClient = createMockClient({
        listTags: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTags,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listTags")!;
      const result = (await tool.handler(
        { projectId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("Bug");
      expect(extractTextContent(result)).toContain("Feature");
      expect(mockClient.listTags).toHaveBeenCalledWith("my-project");
    });
  });

  describe("quire.getTag", () => {
    it("should get tag by OID", async () => {
      const mockTag = { oid: "TagOid", id: 1, name: "Bug", color: 0 };
      const mockClient = createMockClient({
        getTag: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTag,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getTag")!;
      const result = (await tool.handler(
        { oid: "TagOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("Bug");
      expect(mockClient.getTag).toHaveBeenCalledWith("TagOid");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        getTag: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getTag")!;
      const result = (await tool.handler(
        { oid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("NOT_FOUND");
    });
  });

  describe("quire.createTag", () => {
    it("should create tag with minimal params", async () => {
      const mockTag = { oid: "NewTag", id: 3, name: "Enhancement" };
      const mockClient = createMockClient({
        createTag: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTag,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTag")!;
      const result = (await tool.handler(
        { projectId: "my-project", name: "Enhancement" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createTag).toHaveBeenCalledWith("my-project", {
        name: "Enhancement",
      });
    });

    it("should create tag with color", async () => {
      const mockClient = createMockClient({
        createTag: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "NewTag", id: 3, name: "Bug", color: 5 },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTag")!;
      await tool.handler(
        { projectId: "my-project", name: "Bug", color: 5 },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createTag).toHaveBeenCalledWith("my-project", {
        name: "Bug",
        color: 5,
      });
    });

    it("should handle API errors", async () => {
      const mockClient = createMockClient({
        createTag: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createTag")!;
      const result = (await tool.handler(
        { projectId: "my-project", name: "Tag" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("FORBIDDEN");
    });
  });

  describe("quire.updateTag", () => {
    it("should update tag", async () => {
      const mockTag = { oid: "TagOid", id: 1, name: "Updated Tag" };
      const mockClient = createMockClient({
        updateTag: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockTag,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateTag")!;
      const result = (await tool.handler(
        { oid: "TagOid", name: "Updated Tag", color: 3 },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.updateTag).toHaveBeenCalledWith("TagOid", {
        name: "Updated Tag",
        color: 3,
      });
    });
  });

  describe("quire.deleteTag", () => {
    it("should delete tag", async () => {
      const mockClient = createMockClient({
        deleteTag: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "TagOid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteTag")!;
      const result = (await tool.handler(
        { oid: "TagOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteTag).toHaveBeenCalledWith("TagOid");
    });

    it("should handle NOT_FOUND error", async () => {
      const mockClient = createMockClient({
        deleteTag: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteTag")!;
      const result = (await tool.handler(
        { oid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });
});
