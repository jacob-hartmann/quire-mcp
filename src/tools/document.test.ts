import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDocumentTools } from "./document.js";
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

describe("Document Tools", () => {
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

    registerDocumentTools(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all document tools", () => {
    expect(server.registerTool).toHaveBeenCalledTimes(5);
    expect(registeredTools.has("quire.createDocument")).toBe(true);
    expect(registeredTools.has("quire.getDocument")).toBe(true);
    expect(registeredTools.has("quire.listDocuments")).toBe(true);
    expect(registeredTools.has("quire.updateDocument")).toBe(true);
    expect(registeredTools.has("quire.deleteDocument")).toBe(true);
  });

  describe("quire.createDocument", () => {
    it("should return error on authentication failure", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.createDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "Doc" },
        createMockExtra()
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should create document for project", async () => {
      const mockDoc = { oid: "doc-oid", id: "readme", name: "README" };
      const mockClient = createMockClient({
        createDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockDoc,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        {
          ownerType: "project",
          ownerId: "my-project",
          name: "README",
          description: "# Readme",
        },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.createDocument).toHaveBeenCalledWith(
        "project",
        "my-project",
        { name: "README", description: "# Readme" }
      );
    });

    it("should create document for organization", async () => {
      const mockClient = createMockClient({
        createDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "doc-oid", id: "doc", name: "Doc" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "organization", ownerId: "my-org", name: "Doc" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.createDocument).toHaveBeenCalledWith(
        "organization",
        "my-org",
        { name: "Doc" }
      );
    });
  });

  describe("quire.getDocument", () => {
    it("should get document by OID", async () => {
      const mockDoc = { oid: "DocOid", id: "readme", name: "README" };
      const mockClient = createMockClient({
        getDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockDoc,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "DocOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(mockClient.getDocument).toHaveBeenCalledWith("DocOid");
    });

    it("should get document by owner type, owner ID, and doc ID", async () => {
      const mockClient = createMockClient({
        getDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "doc-oid", id: "readme", name: "README" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "project", ownerId: "my-project", documentId: "readme" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.getDocument).toHaveBeenCalledWith(
        "project",
        "my-project",
        "readme"
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getDocument");
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

  describe("quire.listDocuments", () => {
    it("should list documents for project", async () => {
      const mockDocs = [
        { oid: "doc1", id: "readme", name: "README" },
        { oid: "doc2", id: "changelog", name: "CHANGELOG" },
      ];
      const mockClient = createMockClient({
        listDocuments: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockDocs,
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listDocuments");
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
      expect(extractTextContent(result)).toContain("README");
      expect(mockClient.listDocuments).toHaveBeenCalledWith(
        "project",
        "my-project"
      );
    });

    it("should list documents for organization", async () => {
      const mockClient = createMockClient({
        listDocuments: vi.fn().mockResolvedValueOnce({
          success: true,
          data: [],
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listDocuments");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "organization", ownerId: "my-org" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.listDocuments).toHaveBeenCalledWith(
        "organization",
        "my-org"
      );
    });
  });

  describe("quire.updateDocument", () => {
    it("should update document by OID", async () => {
      const mockClient = createMockClient({
        updateDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "DocOid", id: "readme", name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { oid: "DocOid", name: "Updated", description: "New content" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateDocument).toHaveBeenCalledWith("DocOid", {
        name: "Updated",
        description: "New content",
      });
    });

    it("should update document by full path", async () => {
      const mockClient = createMockClient({
        updateDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "doc-oid", id: "readme", name: "Updated" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        {
          ownerType: "project",
          ownerId: "my-project",
          documentId: "readme",
          name: "Updated",
        },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.updateDocument).toHaveBeenCalledWith(
        "project",
        "my-project",
        "readme",
        { name: "Updated" }
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateDocument");
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

  describe("quire.deleteDocument", () => {
    it("should delete document by OID", async () => {
      const mockClient = createMockClient({
        deleteDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "DocOid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "DocOid" },
        createMockExtra({ quireToken: "token" })
      )) as {
        isError?: boolean;
        content: { type: string; text?: string }[];
      };

      expect(isErrorResponse(result)).toBe(false);
      expect(extractTextContent(result)).toContain("deleted successfully");
      expect(mockClient.deleteDocument).toHaveBeenCalledWith("DocOid");
    });

    it("should delete document by full path", async () => {
      const mockClient = createMockClient({
        deleteDocument: vi.fn().mockResolvedValueOnce({
          success: true,
          data: { oid: "doc-oid" },
        }),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      await tool.handler(
        { ownerType: "project", ownerId: "my-project", documentId: "readme" },
        createMockExtra({ quireToken: "token" })
      );

      expect(mockClient.deleteDocument).toHaveBeenCalledWith(
        "project",
        "my-project",
        "readme"
      );
    });

    it("should return error when neither OID nor full path provided", async () => {
      const mockClient = createMockClient();

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteDocument");
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
    it("should return auth error for getDocument", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.getDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "DocOid" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for listDocuments", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.listDocuments");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for updateDocument", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.updateDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "DocOid", name: "Updated" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });

    it("should return auth error for deleteDocument", async () => {
      const mockResult: QuireClientResult = {
        success: false,
        error: "No token",
      };
      vi.mocked(getQuireClient).mockResolvedValueOnce(mockResult);

      const tool = registeredTools.get("quire.deleteDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "DocOid" },
        createMockExtra()
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
      expect(extractTextContent(result)).toContain("Authentication Error");
    });
  });

  describe("API error handling", () => {
    it("should handle createDocument API error", async () => {
      const mockClient = createMockClient({
        createDocument: vi.fn().mockResolvedValueOnce(mockErrors.forbidden()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.createDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project", name: "Doc" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle getDocument API error", async () => {
      const mockClient = createMockClient({
        getDocument: vi.fn().mockResolvedValueOnce(mockErrors.notFound()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.getDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "nonexistent" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle listDocuments API error", async () => {
      const mockClient = createMockClient({
        listDocuments: vi.fn().mockResolvedValueOnce(mockErrors.unauthorized()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.listDocuments");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { ownerType: "project", ownerId: "my-project" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle updateDocument API error", async () => {
      const mockClient = createMockClient({
        updateDocument: vi.fn().mockResolvedValueOnce(mockErrors.rateLimited()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.updateDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "DocOid", name: "Updated" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });

    it("should handle deleteDocument API error", async () => {
      const mockClient = createMockClient({
        deleteDocument: vi.fn().mockResolvedValueOnce(mockErrors.serverError()),
      });

      vi.mocked(getQuireClient).mockResolvedValueOnce({
        success: true,
        client: mockClient,
      });

      const tool = registeredTools.get("quire.deleteDocument");
      expect(tool).toBeDefined();
      if (!tool) return;
      const result = (await tool.handler(
        { oid: "DocOid" },
        createMockExtra({ quireToken: "token" })
      )) as { isError?: boolean; content: { type: string; text?: string }[] };

      expect(isErrorResponse(result)).toBe(true);
    });
  });
});
