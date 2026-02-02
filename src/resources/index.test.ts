import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "./index.js";

vi.mock("./user-me.js", () => ({
  registerUserMeResource: vi.fn(),
}));

vi.mock("./organizations.js", () => ({
  registerOrganizationsResource: vi.fn(),
}));

vi.mock("./projects.js", () => ({
  registerProjectsResource: vi.fn(),
}));

vi.mock("./project.js", () => ({
  registerProjectResource: vi.fn(),
}));

vi.mock("./project-tasks.js", () => ({
  registerProjectTasksResource: vi.fn(),
}));

vi.mock("./project-tags.js", () => ({
  registerProjectTagsResource: vi.fn(),
}));

vi.mock("./project-statuses.js", () => ({
  registerProjectStatusesResource: vi.fn(),
}));

import { registerUserMeResource } from "./user-me.js";
import { registerOrganizationsResource } from "./organizations.js";
import { registerProjectsResource } from "./projects.js";
import { registerProjectResource } from "./project.js";
import { registerProjectTasksResource } from "./project-tasks.js";
import { registerProjectTagsResource } from "./project-tags.js";
import { registerProjectStatusesResource } from "./project-statuses.js";

describe("registerResources", () => {
  let mockServer: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {} as McpServer;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should register all static resources", () => {
    registerResources(mockServer);

    expect(registerUserMeResource).toHaveBeenCalledWith(mockServer);
    expect(registerOrganizationsResource).toHaveBeenCalledWith(mockServer);
    expect(registerProjectsResource).toHaveBeenCalledWith(mockServer);
  });

  it("should register all resource templates", () => {
    registerResources(mockServer);

    expect(registerProjectResource).toHaveBeenCalledWith(mockServer);
    expect(registerProjectTasksResource).toHaveBeenCalledWith(mockServer);
    expect(registerProjectTagsResource).toHaveBeenCalledWith(mockServer);
    expect(registerProjectStatusesResource).toHaveBeenCalledWith(mockServer);
  });

  it("should register all 7 resources exactly once", () => {
    registerResources(mockServer);

    expect(registerUserMeResource).toHaveBeenCalledTimes(1);
    expect(registerOrganizationsResource).toHaveBeenCalledTimes(1);
    expect(registerProjectsResource).toHaveBeenCalledTimes(1);
    expect(registerProjectResource).toHaveBeenCalledTimes(1);
    expect(registerProjectTasksResource).toHaveBeenCalledTimes(1);
    expect(registerProjectTagsResource).toHaveBeenCalledTimes(1);
    expect(registerProjectStatusesResource).toHaveBeenCalledTimes(1);
  });
});
