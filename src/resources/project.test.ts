import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectResource } from "./project.js";

vi.mock("../quire/client-factory.js", () => ({
  getQuireClientOrThrow: vi.fn(),
}));

vi.mock("./completions.js", () => ({
  createProjectIdCompleter: vi.fn(() => vi.fn()),
}));

import { getQuireClientOrThrow } from "../quire/client-factory.js";

describe("registerProjectResource", () => {
  let server: McpServer;
  let registeredResources: Map<
    string,
    {
      template: unknown;
      description: string;
      handler: (
        uri: URL,
        variables: Record<string, string>,
        extra: unknown
      ) => Promise<unknown>;
    }
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    registeredResources = new Map();
    server = {
      registerResource: vi.fn(
        (
          name: string,
          template: unknown,
          config: { description: string },
          handler: (
            uri: URL,
            variables: Record<string, string>,
            extra: unknown
          ) => Promise<unknown>
        ) => {
          registeredResources.set(name, {
            template,
            description: config.description,
            handler,
          });
        }
      ),
    } as unknown as McpServer;

    registerProjectResource(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register project resource template", () => {
    expect(server.registerResource).toHaveBeenCalledWith(
      "project",
      expect.any(Object), // ResourceTemplate
      expect.objectContaining({
        description: expect.any(String) as unknown as string,
      }),
      expect.any(Function)
    );
    expect(registeredResources.has("project")).toBe(true);
  });

  describe("resource handler", () => {
    it("should return project data on success", async () => {
      const mockProject = {
        oid: "proj-oid-1",
        id: "proj1",
        name: "Test Project",
        description: "Test Description",
      };

      const mockClient = {
        getProject: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockProject,
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("project");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project/proj1");
      const result = (await resource.handler(mockUri, { id: "proj1" }, {})) as {
        contents: { uri: string; mimeType: string; text: string }[];
      };

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]?.mimeType).toBe("application/json");
      expect(JSON.parse(result.contents[0]?.text ?? "")).toEqual(mockProject);
      expect(mockClient.getProject).toHaveBeenCalledWith("proj1");
    });

    it("should throw error when project ID is missing", async () => {
      const resource = registeredResources.get("project");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project/");

      await expect(resource.handler(mockUri, { id: "" }, {})).rejects.toThrow(
        "Project ID is required"
      );
    });

    it("should throw error on client failure", async () => {
      const mockClient = {
        getProject: vi.fn().mockResolvedValueOnce({
          success: false,
          error: { code: "NOT_FOUND", message: "Project not found" },
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("project");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project/proj1");

      await expect(
        resource.handler(mockUri, { id: "proj1" }, {})
      ).rejects.toThrow(
        "Failed to fetch project: NOT_FOUND - Project not found"
      );
    });

    it("should propagate getQuireClientOrThrow errors", async () => {
      vi.mocked(getQuireClientOrThrow).mockRejectedValueOnce(
        new Error("Authentication required")
      );

      const resource = registeredResources.get("project");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project/proj1");

      await expect(
        resource.handler(mockUri, { id: "proj1" }, {})
      ).rejects.toThrow("Authentication required");
    });
  });
});
