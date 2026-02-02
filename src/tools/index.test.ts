import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./index.js";

// Mock all tool registration modules
vi.mock("./whoami.js", () => ({
  registerWhoamiTool: vi.fn(),
}));
vi.mock("./organization.js", () => ({
  registerOrganizationTools: vi.fn(),
}));
vi.mock("./project.js", () => ({
  registerProjectTools: vi.fn(),
}));
vi.mock("./task.js", () => ({
  registerTaskTools: vi.fn(),
}));
vi.mock("./tag.js", () => ({
  registerTagTools: vi.fn(),
}));
vi.mock("./comment.js", () => ({
  registerCommentTools: vi.fn(),
}));
vi.mock("./user.js", () => ({
  registerUserTools: vi.fn(),
}));
vi.mock("./status.js", () => ({
  registerStatusTools: vi.fn(),
}));
vi.mock("./partner.js", () => ({
  registerPartnerTools: vi.fn(),
}));
vi.mock("./document.js", () => ({
  registerDocumentTools: vi.fn(),
}));
vi.mock("./sublist.js", () => ({
  registerSublistTools: vi.fn(),
}));
vi.mock("./chat.js", () => ({
  registerChatTools: vi.fn(),
}));
vi.mock("./storage.js", () => ({
  registerStorageTools: vi.fn(),
}));
vi.mock("./notification.js", () => ({
  registerNotificationTools: vi.fn(),
}));
vi.mock("./attachment.js", () => ({
  registerAttachmentTools: vi.fn(),
}));

import { registerWhoamiTool } from "./whoami.js";
import { registerOrganizationTools } from "./organization.js";
import { registerProjectTools } from "./project.js";
import { registerTaskTools } from "./task.js";
import { registerTagTools } from "./tag.js";
import { registerCommentTools } from "./comment.js";
import { registerUserTools } from "./user.js";
import { registerStatusTools } from "./status.js";
import { registerPartnerTools } from "./partner.js";
import { registerDocumentTools } from "./document.js";
import { registerSublistTools } from "./sublist.js";
import { registerChatTools } from "./chat.js";
import { registerStorageTools } from "./storage.js";
import { registerNotificationTools } from "./notification.js";
import { registerAttachmentTools } from "./attachment.js";

describe("registerTools", () => {
  let mockServer: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {} as McpServer;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should call all tool registration functions", () => {
    registerTools(mockServer);

    expect(registerWhoamiTool).toHaveBeenCalledWith(mockServer);
    expect(registerOrganizationTools).toHaveBeenCalledWith(mockServer);
    expect(registerProjectTools).toHaveBeenCalledWith(mockServer);
    expect(registerTaskTools).toHaveBeenCalledWith(mockServer);
    expect(registerTagTools).toHaveBeenCalledWith(mockServer);
    expect(registerCommentTools).toHaveBeenCalledWith(mockServer);
    expect(registerUserTools).toHaveBeenCalledWith(mockServer);
    expect(registerStatusTools).toHaveBeenCalledWith(mockServer);
    expect(registerPartnerTools).toHaveBeenCalledWith(mockServer);
    expect(registerDocumentTools).toHaveBeenCalledWith(mockServer);
    expect(registerSublistTools).toHaveBeenCalledWith(mockServer);
    expect(registerChatTools).toHaveBeenCalledWith(mockServer);
    expect(registerStorageTools).toHaveBeenCalledWith(mockServer);
    expect(registerNotificationTools).toHaveBeenCalledWith(mockServer);
    expect(registerAttachmentTools).toHaveBeenCalledWith(mockServer);
  });

  it("should call each registration function exactly once", () => {
    registerTools(mockServer);

    expect(registerWhoamiTool).toHaveBeenCalledTimes(1);
    expect(registerOrganizationTools).toHaveBeenCalledTimes(1);
    expect(registerProjectTools).toHaveBeenCalledTimes(1);
    expect(registerTaskTools).toHaveBeenCalledTimes(1);
    expect(registerTagTools).toHaveBeenCalledTimes(1);
    expect(registerCommentTools).toHaveBeenCalledTimes(1);
    expect(registerUserTools).toHaveBeenCalledTimes(1);
    expect(registerStatusTools).toHaveBeenCalledTimes(1);
    expect(registerPartnerTools).toHaveBeenCalledTimes(1);
    expect(registerDocumentTools).toHaveBeenCalledTimes(1);
    expect(registerSublistTools).toHaveBeenCalledTimes(1);
    expect(registerChatTools).toHaveBeenCalledTimes(1);
    expect(registerStorageTools).toHaveBeenCalledTimes(1);
    expect(registerNotificationTools).toHaveBeenCalledTimes(1);
    expect(registerAttachmentTools).toHaveBeenCalledTimes(1);
  });
});
