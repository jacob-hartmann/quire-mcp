import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "./index.js";

vi.mock("./user-me.js", () => ({
  registerUserMeResource: vi.fn(),
}));

import { registerUserMeResource } from "./user-me.js";

describe("registerResources", () => {
  let mockServer: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {} as McpServer;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should call registerUserMeResource", () => {
    registerResources(mockServer);

    expect(registerUserMeResource).toHaveBeenCalledWith(mockServer);
  });

  it("should call registerUserMeResource exactly once", () => {
    registerResources(mockServer);

    expect(registerUserMeResource).toHaveBeenCalledTimes(1);
  });
});
