import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies before any imports
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockRegisterTools = vi.fn();
const mockRegisterResources = vi.fn();
const mockRegisterPrompts = vi.fn();
const mockGetHttpServerConfig = vi.fn();
const mockStartHttpServer = vi.fn();

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn(function (this: unknown, _config: unknown) {
    return {
      connect: mockConnect,
    };
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(function (this: unknown) {
    return {};
  }),
}));

vi.mock("./tools/index.js", () => ({
  registerTools: mockRegisterTools,
}));

vi.mock("./resources/index.js", () => ({
  registerResources: mockRegisterResources,
}));

vi.mock("./prompts/index.js", () => ({
  registerPrompts: mockRegisterPrompts,
}));

vi.mock("./server/index.js", () => ({
  getHttpServerConfig: mockGetHttpServerConfig,
  startHttpServer: mockStartHttpServer,
}));

/**
 * Integration tests for the main entry point (src/index.ts)
 *
 * These tests verify the server starts correctly in both stdio and HTTP modes.
 * Since index.ts executes on import, we use dynamic imports with mocked dependencies.
 */

describe("Main Entry Point (src/index.ts)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.error and process.exit
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    // Clear all mocks
    vi.clearAllMocks();

    // Reset modules to allow fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    (consoleErrorSpy as unknown as ReturnType<typeof vi.fn>).mockRestore();
    (processExitSpy as unknown as ReturnType<typeof vi.fn>).mockRestore();
    vi.unstubAllEnvs();
  });

  describe("stdio mode (default)", () => {
    it("should start server in stdio mode when MCP_TRANSPORT is not set", async () => {
      // Set environment
      delete process.env["MCP_TRANSPORT"];

      // Dynamically import to trigger execution
      await import("./index.js");

      // Wait for async operations
      await vi.waitFor(
        () => {
          expect(mockConnect).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Starting server")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("stdio transport")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Server running on stdio transport")
      );
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(mockRegisterTools).toHaveBeenCalled();
      expect(mockRegisterResources).toHaveBeenCalled();
      expect(mockRegisterPrompts).toHaveBeenCalled();
    });

    it("should start server in stdio mode when MCP_TRANSPORT is 'stdio'", async () => {
      process.env["MCP_TRANSPORT"] = "stdio";

      await import("./index.js");

      await vi.waitFor(
        () => {
          expect(mockConnect).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("stdio transport")
      );
    });
  });

  describe("http mode", () => {
    it("should start server in HTTP mode with valid OAuth config", async () => {
      const mockHttpConfig = {
        oauthClientId: "test-client-id",
        oauthClientSecret: "test-client-secret",
        host: "localhost",
        port: 3000,
      };

      mockGetHttpServerConfig.mockReturnValueOnce(mockHttpConfig);
      mockStartHttpServer.mockResolvedValueOnce(undefined);

      process.env["MCP_TRANSPORT"] = "http";

      await import("./index.js");

      await vi.waitFor(
        () => {
          expect(mockStartHttpServer).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("http transport")
      );
      expect(mockStartHttpServer).toHaveBeenCalledWith(
        expect.any(Function),
        mockHttpConfig
      );
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it("should exit with error when HTTP mode is set but OAuth config is missing", async () => {
      mockGetHttpServerConfig.mockReturnValueOnce(null);

      process.env["MCP_TRANSPORT"] = "http";

      await import("./index.js");

      await vi.waitFor(
        () => {
          expect(processExitSpy).toHaveBeenCalledWith(1);
        },
        { timeout: 2000 }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("HTTP mode requires OAuth configuration")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("QUIRE_OAUTH_CLIENT_ID")
      );
    });
  });

  describe("error handling", () => {
    it("should handle and log errors during startup", async () => {
      const testError = new Error("Startup failed");
      mockConnect.mockRejectedValueOnce(testError);

      delete process.env["MCP_TRANSPORT"];

      await import("./index.js");

      await vi.waitFor(
        () => {
          expect(processExitSpy).toHaveBeenCalledWith(1);
        },
        { timeout: 2000 }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Fatal error"),
        testError
      );
    });

    it("should handle errors from HTTP server startup", async () => {
      const testError = new Error("HTTP server failed");

      mockGetHttpServerConfig.mockReturnValueOnce({
        oauthClientId: "test",
        oauthClientSecret: "test",
        host: "localhost",
        port: 3000,
      });
      mockStartHttpServer.mockRejectedValueOnce(testError);

      process.env["MCP_TRANSPORT"] = "http";

      await import("./index.js");

      await vi.waitFor(
        () => {
          expect(processExitSpy).toHaveBeenCalledWith(1);
        },
        { timeout: 2000 }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Fatal error"),
        testError
      );
    });
  });

  describe("server creation", () => {
    it("should register all handlers (tools, resources, prompts)", async () => {
      delete process.env["MCP_TRANSPORT"];

      await import("./index.js");

      await vi.waitFor(
        () => {
          expect(mockConnect).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      expect(mockRegisterTools).toHaveBeenCalled();
      expect(mockRegisterResources).toHaveBeenCalled();
      expect(mockRegisterPrompts).toHaveBeenCalled();
    });
  });
});
