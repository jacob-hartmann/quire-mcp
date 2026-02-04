import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectsResource } from "./projects.js";

vi.mock("../quire/client-factory.js", () => ({
  getQuireClientOrThrow: vi.fn(),
}));

import { getQuireClientOrThrow } from "../quire/client-factory.js";

describe("registerProjectsResource", () => {
  let server: McpServer;
  let registeredResources: Map<
    string,
    {
      uri: string;
      description: string;
      handler: (uri: string, extra: unknown) => Promise<unknown>;
    }
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    registeredResources = new Map();
    server = {
      registerResource: vi.fn(
        (
          name: string,
          uri: string,
          config: { description: string },
          handler: (uri: string, extra: unknown) => Promise<unknown>
        ) => {
          registeredResources.set(name, {
            uri,
            description: config.description,
            handler,
          });
        }
      ),
    } as unknown as McpServer;

    registerProjectsResource(server);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register projects resource", () => {
    expect(server.registerResource).toHaveBeenCalledWith(
      "projects",
      "quire://projects",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        description: expect.any(String),
      }),
      expect.any(Function)
    );
    expect(registeredResources.has("projects")).toBe(true);
    expect(registeredResources.get("projects")?.uri).toBe("quire://projects");
  });

  describe("resource handler", () => {
    it("should return projects data on success", async () => {
      const mockProjects = [
        {
          oid: "proj-oid-1",
          id: "proj1",
          name: "Test Project 1",
          description: "Description 1",
        },
        {
          oid: "proj-oid-2",
          id: "proj2",
          name: "Test Project 2",
          description: "Description 2",
        },
      ];

      const mockClient = {
        listProjects: vi.fn().mockResolvedValueOnce({
          success: true,
          data: mockProjects,
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("projects");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      const result = (await resource.handler("quire://projects", {})) as {
        contents: {
          uri: string;
          mimeType: string;
          text: string;
        }[];
      };

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0];
      expect(content).toBeDefined();
      expect(content?.uri).toBe("quire://projects");
      expect(content?.mimeType).toBe("application/json");
      expect(content && JSON.parse(content.text)).toEqual(mockProjects);
    });

    it("should throw error on client failure", async () => {
      const mockClient = {
        listProjects: vi.fn().mockResolvedValueOnce({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid token" },
        }),
      };

      vi.mocked(getQuireClientOrThrow).mockResolvedValueOnce(
        mockClient as unknown as Awaited<
          ReturnType<typeof getQuireClientOrThrow>
        >
      );

      const resource = registeredResources.get("projects");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      await expect(resource.handler("quire://projects", {})).rejects.toThrow(
        "Failed to fetch projects: UNAUTHORIZED - Invalid token"
      );
    });

    it("should propagate getQuireClientOrThrow errors", async () => {
      vi.mocked(getQuireClientOrThrow).mockRejectedValueOnce(
        new Error("Authentication required")
      );

      const resource = registeredResources.get("projects");
      expect(resource).toBeDefined();
      if (!resource) throw new Error("Resource not found");

      await expect(resource.handler("quire://projects", {})).rejects.toThrow(
        "Authentication required"
      );
    });
  });
});
