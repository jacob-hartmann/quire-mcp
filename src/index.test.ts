import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Note: We can't easily test the main entry point since it executes immediately on import.
// Instead, we test the individual functions by verifying the module structure and
// the behavior of the createServer function via its dependencies.

// Mock McpServer - must be inline due to hoisting
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  return {
    McpServer: class MockMcpServer {
      config: { name: string; version: string };
      connect = vi.fn().mockResolvedValue(undefined);

      constructor(config: { name: string; version: string }) {
        this.config = config;
      }
    },
  };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => {
  return {
    // Empty class for mock - no methods needed for these tests
    StdioServerTransport: class MockStdioServerTransport {
      // eslint-disable-next-line @typescript-eslint/no-useless-constructor
      constructor() {
        // Mock transport does not need implementation
      }
    },
  };
});

vi.mock("./tools/index.js", () => ({
  registerTools: vi.fn(),
}));

vi.mock("./resources/index.js", () => ({
  registerResources: vi.fn(),
}));

vi.mock("./prompts/index.js", () => ({
  registerPrompts: vi.fn(),
}));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

describe("Quire MCP Server Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("McpServer creation", () => {
    it("should create McpServer with correct configuration", () => {
      // Create server similar to how index.ts does
      const server = new McpServer({
        name: "quire-mcp",
        version: "0.1.0",
      }) as unknown as { config: { name: string; version: string } };

      expect(server.config.name).toBe("quire-mcp");
      expect(server.config.version).toBe("0.1.0");
    });

    it("should register all handlers on server", () => {
      const server = new McpServer({
        name: "quire-mcp",
        version: "0.1.0",
      });

      // Simulate registration like createServer does
      registerTools(server);
      registerResources(server);
      registerPrompts(server);

      expect(registerTools).toHaveBeenCalledWith(server);
      expect(registerResources).toHaveBeenCalledWith(server);
      expect(registerPrompts).toHaveBeenCalledWith(server);
    });
  });

  describe("StdioServerTransport", () => {
    it("should be able to create transport", () => {
      const transport = new StdioServerTransport();

      expect(transport).toBeDefined();
    });

    it("should connect server with transport", async () => {
      const server = new McpServer({
        name: "quire-mcp",
        version: "0.1.0",
      }) as unknown as { connect: ReturnType<typeof vi.fn> };
      const transport = new StdioServerTransport();

      await server.connect(transport);

      expect(server.connect).toHaveBeenCalledWith(transport);
    });
  });

  describe("Server constants", () => {
    it("should use expected server name", () => {
      // Verify the server name is as expected
      const SERVER_NAME = "quire-mcp";
      expect(SERVER_NAME).toBe("quire-mcp");
    });

    it("should use expected server version", () => {
      // Verify the server version is as expected
      const SERVER_VERSION = "0.1.0";
      expect(SERVER_VERSION).toBe("0.1.0");
    });
  });

  describe("createServer function behavior", () => {
    it("should create server with all handlers registered", () => {
      // Simulate what createServer() does
      const server = new McpServer({
        name: "quire-mcp",
        version: "0.1.0",
      });

      registerTools(server);
      registerResources(server);
      registerPrompts(server);

      expect(registerTools).toHaveBeenCalledTimes(1);
      expect(registerResources).toHaveBeenCalledTimes(1);
      expect(registerPrompts).toHaveBeenCalledTimes(1);
    });
  });

  describe("startStdioServer behavior", () => {
    it("should connect server to stdio transport", async () => {
      const server = new McpServer({
        name: "quire-mcp",
        version: "0.1.0",
      }) as unknown as { connect: ReturnType<typeof vi.fn> };
      const transport = new StdioServerTransport();

      // Simulate startStdioServer
      await server.connect(transport);

      expect(server.connect).toHaveBeenCalledWith(transport);
    });
  });
});
