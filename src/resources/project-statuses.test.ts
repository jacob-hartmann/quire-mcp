import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectStatusesResource } from "./project-statuses.js";

vi.mock("../quire/client-factory.js", () => ({
  getQuireClientOrThrow: vi.fn(),
}));

vi.mock("./completions.js", () => ({
  createProjectIdCompleter: vi.fn(() => vi.fn()),
}));

import { getQuireClientOrThrow } from "../quire/client-factory.js";

describe("registerProjectStatusesResource", () => {
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

    registerProjectStatusesResource(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register project-statuses resource template", () => {
    expect(server.registerResource).toHaveBeenCalledWith(
      "project-statuses",
      expect.any(Object),
      expect.objectContaining({
        description: expect.any(String) as unknown as string,
      }),
      expect.any(Function)
    );
    expect(registeredResources.has("project-statuses")).toBe(true);
  });

  describe("resource handler", () => {
    it("should return statuses data on success", async () => {
      const mockStatuses = [
        { id: 0, name: "To Do", color: 1 },
        { id: 100, name: "Done", color: 2 },
      ];

      const mockClient = {
        listStatuses: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockStatuses,
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("project-statuses");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project/proj1/statuses");
      const result = (await resource.handler(
        mockUri,
        { projectId: "proj1" },
        {}
      )) as {
        contents: { uri: string; mimeType: string; text: string }[];
      };

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]?.mimeType).toBe("application/json");
      expect(JSON.parse(result.contents[0]?.text ?? "")).toEqual(mockStatuses);
      expect(mockClient.listStatuses).toHaveBeenCalledWith("proj1");
    });

    it("should throw error when project ID is missing", async () => {
      const resource = registeredResources.get("project-statuses");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project//statuses");

      await expect(
        resource.handler(mockUri, { projectId: "" }, {})
      ).rejects.toThrow("Project ID is required");
    });

    it("should throw error on client failure", async () => {
      const mockClient = {
        listStatuses: vi.fn().mockResolvedValueOnce({
          success: false,
          error: { code: "NOT_FOUND", message: "Project not found" },
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("project-statuses");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project/proj1/statuses");

      await expect(
        resource.handler(mockUri, { projectId: "proj1" }, {})
      ).rejects.toThrow(
        "Failed to fetch statuses: NOT_FOUND - Project not found"
      );
    });

    it("should propagate getQuireClientOrThrow errors", async () => {
      vi.mocked(getQuireClientOrThrow).mockRejectedValueOnce(
        new Error("Authentication required")
      );

      const resource = registeredResources.get("project-statuses");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const mockUri = new URL("quire://project/proj1/statuses");

      await expect(
        resource.handler(mockUri, { projectId: "proj1" }, {})
      ).rejects.toThrow("Authentication required");
    });
  });
});
