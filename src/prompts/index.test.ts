import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./index.js";

describe("registerPrompts", () => {
  it("should not throw when called", () => {
    const mockServer = {} as McpServer;

    expect(() => registerPrompts(mockServer)).not.toThrow();
  });

  it("should accept any McpServer instance", () => {
    const mockServer = {
      registerPrompt: () => {},
    } as unknown as McpServer;

    // Function should complete without errors
    registerPrompts(mockServer);
  });
});
