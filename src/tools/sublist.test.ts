import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSublistTools } from "./sublist.js";
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

describe("Sublist Tools", () => {
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

    registerSublistTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all sublist tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(5);
    expect(registeredTools.has("quire.createSublist")).toBe(true);
    expect(registeredTools.has("quire.getSublist")).toBe(true);
    expect(registeredTools.has("quire.listSublists")).toBe(true);
    expect(registeredTools.has("quire.updateSublist")).toBe(true);
    expect(registeredTools.has("quire.deleteSublist")).toBe(true);
  });

  describe("quire.createSublist", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.createSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "Sprint 1" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should create sublist for project", async () => {
      const mockSublist = {
        oid: "sublist-oid",
        id: "sprint-1",
        name: "Sprint 1",
      };
      const mockClient = createMockClient({
        createSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockSublist,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "Sprint 1" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createSublist).toHaveBeenCalledWith(
        "project",
        "my-project",
        { name: "Sprint 1" }
      );
    });

    it("should create sublist with description", async () => {
      const mockClient = createMockClient({
        createSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "sublist-oid", id: "sprint-1", name: "Sprint 1" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        {
          ownerType: "project",
          ownerId: "my-project",
          name: "Sprint 1",
          description: "First sprint",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createSublist).toHaveBeenCalledWith(
        "project",
        "my-project",
        { name: "Sprint 1", description: "First sprint" }
      );
    });
  });

  describe("quire.getSublist", () => {
    it("should get sublist by OID", async () => {
      const mockSublist = {
        oid: "SublistOid",
        id: "sprint-1",
        name: "Sprint 1",
      };
      const mockClient = createMockClient({
        getSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockSublist,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "SublistOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.getSublist).toHaveBeenCalledWith("SublistOid");
    });

    it("should get sublist by full path", async () => {
      const mockClient = createMockClient({
        getSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "sublist-oid", id: "sprint-1", name: "Sprint 1" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "project", ownerId: "my-project", sublistId: "sprint-1" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.getSublist).toHaveBeenCalledWith(
        "project",
        "my-project",
        "sprint-1"
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.listSublists", () => {
    it("should list sublists for project", async () => {
      const mockSublists = [
        { oid: "sublist1", id: "sprint-1", name: "Sprint 1" },
        { oid: "sublist2", id: "sprint-2", name: "Sprint 2" },
      ];
      const mockClient = createMockClient({
        listSublists: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockSublists,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listSublists");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("Sprint 1");
      expect(mockClient.listSublists).toHaveBeenCalledWith(
        "project",
        "my-project"
      );
    });
  });

  describe("quire.updateSublist", () => {
    it("should update sublist by OID", async () => {
      const mockClient = createMockClient({
        updateSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "SublistOid", id: "sprint-1", name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { oid: "SublistOid", name: "Updated" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateSublist).toHaveBeenCalledWith("SublistOid", {
        name: "Updated",
      });
    });

    it("should update sublist by full path", async () => {
      const mockClient = createMockClient({
        updateSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "sublist-oid", id: "sprint-1", name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        {
          ownerType: "project",
          ownerId: "my-project",
          sublistId: "sprint-1",
          name: "Updated",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateSublist).toHaveBeenCalledWith(
        "project",
        "my-project",
        "sprint-1",
        { name: "Updated" }
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { name: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
    });
  });

  describe("quire.deleteSublist", () => {
    it("should delete sublist by OID", async () => {
      const mockClient = createMockClient({
        deleteSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "SublistOid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "SublistOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteSublist).toHaveBeenCalledWith("SublistOid");
    });

    it("should delete sublist by full path", async () => {
      const mockClient = createMockClient({
        deleteSublist: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "sublist-oid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "project", ownerId: "my-project", sublistId: "sprint-1" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.deleteSublist).toHaveBeenCalledWith(
        "project",
        "my-project",
        "sprint-1"
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
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

  describe("authentication failures", () => {
    it("should return auth error for getSublist", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.getSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "SublistOid" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for listSublists", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listSublists");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for updateSublist", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.updateSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "SublistOid", name: "Updated" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for deleteSublist", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.deleteSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "SublistOid" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });
  });

  describe("API error handling", () => {
    it("should handle createSublist API error", async () => {
      const mockClient = createMockClient({
        createSublist: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "Sublist" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle getSublist API error", async () => {
      const mockClient = createMockClient({
        getSublist: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle listSublists API error", async () => {
      const mockClient = createMockClient({
        listSublists: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listSublists");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle updateSublist API error", async () => {
      const mockClient = createMockClient({
        updateSublist: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "SublistOid", name: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle deleteSublist API error", async () => {
      const mockClient = createMockClient({
        deleteSublist: vi.fn().mockResolvedValueOnce(mockErrors.serverError()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteSublist");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "SublistOid" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });
  });
});
