import { describe, it, expect } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./index.js";

describe("registerPrompts", () => {
  it("should not throw when called", () => {
    const mockServer = {} as McpServer;

    expect(() => {
      registerPrompts(mockServer);
    }).not.toThrow();
  });

  it("should accept any McpServer instance", () => {
    const mockServer = {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      registerPrompt: () => {},
    } as unknown as McpServer;

    // Function should complete without errors
    registerPrompts(mockServer);
  });
});
