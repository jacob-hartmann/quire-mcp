import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./index.js";

// Define types for prompt handler and result
type PromptArgs = Record<string, string | number | undefined>;
interface PromptMessage {
  role: string;
  content: {
    type: string;
    text: string;
  };
}
type PromptHandler = (args: PromptArgs) => {
  messages: PromptMessage[];
};
type RegisterPromptCall = [
  string,
  { description: string; argsSchema: unknown },
  PromptHandler,
];

describe("registerPrompts", () => {
  it("should register all prompts with the server", () => {
    const mockRegisterPrompt = vi.fn();
    const mockServer = {
      registerPrompt: mockRegisterPrompt,
    } as unknown as McpServer;

    registerPrompts(mockServer);

    // Should register 5 prompts
    expect(mockRegisterPrompt).toHaveBeenCalledTimes(5);
  });

  it("should register quire.create-project-plan prompt", () => {
    const mockRegisterPrompt = vi.fn();
    const mockServer = {
      registerPrompt: mockRegisterPrompt,
    } as unknown as McpServer;

    registerPrompts(mockServer);

    // Find the create-project-plan registration call
    const createProjectPlanCall = (
      mockRegisterPrompt.mock.calls as RegisterPromptCall[]
    ).find((call) => call[0] === "quire.create-project-plan");

    expect(createProjectPlanCall).toBeDefined();
    expect(createProjectPlanCall![1]).toHaveProperty("description");
    expect(createProjectPlanCall![1]).toHaveProperty("argsSchema");
    expect(typeof createProjectPlanCall![2]).toBe("function");
  });

  it("should register quire.daily-standup prompt", () => {
    const mockRegisterPrompt = vi.fn();
    const mockServer = {
      registerPrompt: mockRegisterPrompt,
    } as unknown as McpServer;

    registerPrompts(mockServer);

    const dailyStandupCall = (
      mockRegisterPrompt.mock.calls as RegisterPromptCall[]
    ).find((call) => call[0] === "quire.daily-standup");

    expect(dailyStandupCall).toBeDefined();
    expect(dailyStandupCall![1]).toHaveProperty("description");
    expect(dailyStandupCall![1]).toHaveProperty("argsSchema");
    expect(typeof dailyStandupCall![2]).toBe("function");
  });

  it("should register quire.sprint-planning prompt", () => {
    const mockRegisterPrompt = vi.fn();
    const mockServer = {
      registerPrompt: mockRegisterPrompt,
    } as unknown as McpServer;

    registerPrompts(mockServer);

    const sprintPlanningCall = (
      mockRegisterPrompt.mock.calls as RegisterPromptCall[]
    ).find((call) => call[0] === "quire.sprint-planning");

    expect(sprintPlanningCall).toBeDefined();
    expect(sprintPlanningCall![1]).toHaveProperty("description");
    expect(sprintPlanningCall![1]).toHaveProperty("argsSchema");
    expect(typeof sprintPlanningCall![2]).toBe("function");
  });

  it("should register quire.task-breakdown prompt", () => {
    const mockRegisterPrompt = vi.fn();
    const mockServer = {
      registerPrompt: mockRegisterPrompt,
    } as unknown as McpServer;

    registerPrompts(mockServer);

    const taskBreakdownCall = (
      mockRegisterPrompt.mock.calls as RegisterPromptCall[]
    ).find((call) => call[0] === "quire.task-breakdown");

    expect(taskBreakdownCall).toBeDefined();
    expect(taskBreakdownCall![1]).toHaveProperty("description");
    expect(taskBreakdownCall![1]).toHaveProperty("argsSchema");
    expect(typeof taskBreakdownCall![2]).toBe("function");
  });

  it("should register quire.weekly-summary prompt", () => {
    const mockRegisterPrompt = vi.fn();
    const mockServer = {
      registerPrompt: mockRegisterPrompt,
    } as unknown as McpServer;

    registerPrompts(mockServer);

    const weeklySummaryCall = (
      mockRegisterPrompt.mock.calls as RegisterPromptCall[]
    ).find((call) => call[0] === "quire.weekly-summary");

    expect(weeklySummaryCall).toBeDefined();
    expect(weeklySummaryCall![1]).toHaveProperty("description");
    expect(weeklySummaryCall![1]).toHaveProperty("argsSchema");
    expect(typeof weeklySummaryCall![2]).toBe("function");
  });

  describe("prompt handlers", () => {
    it("should return correct message structure for create-project-plan", () => {
      const mockRegisterPrompt = vi.fn();
      const mockServer = {
        registerPrompt: mockRegisterPrompt,
      } as unknown as McpServer;

      registerPrompts(mockServer);

      const createProjectPlanCall = (
        mockRegisterPrompt.mock.calls as RegisterPromptCall[]
      ).find((call) => call[0] === "quire.create-project-plan");
      const handler = createProjectPlanCall![2];

      const result = handler({
        projectId: "test-project",
        goal: "Build a new feature",
      });

      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(1);
      const message = result.messages[0]!;
      expect(message).toHaveProperty("role", "user");
      expect(message.content).toHaveProperty("type", "text");
      expect(message.content.text).toContain("test-project");
      expect(message.content.text).toContain("Build a new feature");
    });

    it("should return correct message structure for daily-standup", () => {
      const mockRegisterPrompt = vi.fn();
      const mockServer = {
        registerPrompt: mockRegisterPrompt,
      } as unknown as McpServer;

      registerPrompts(mockServer);

      const dailyStandupCall = (
        mockRegisterPrompt.mock.calls as RegisterPromptCall[]
      ).find((call) => call[0] === "quire.daily-standup");
      const handler = dailyStandupCall![2];

      const result = handler({
        projectId: "test-project",
        userId: "john-doe",
      });

      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(1);
      const message = result.messages[0]!;
      expect(message.content.text).toContain("test-project");
      expect(message.content.text).toContain("john-doe");
    });

    it("should return correct message structure for sprint-planning", () => {
      const mockRegisterPrompt = vi.fn();
      const mockServer = {
        registerPrompt: mockRegisterPrompt,
      } as unknown as McpServer;

      registerPrompts(mockServer);

      const sprintPlanningCall = (
        mockRegisterPrompt.mock.calls as RegisterPromptCall[]
      ).find((call) => call[0] === "quire.sprint-planning");
      const handler = sprintPlanningCall![2];

      const result = handler({
        projectId: "test-project",
        sprintDays: 14,
      });

      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(1);
      const message = result.messages[0]!;
      expect(message.content.text).toContain("test-project");
      expect(message.content.text).toContain("14");
    });

    it("should return correct message structure for task-breakdown", () => {
      const mockRegisterPrompt = vi.fn();
      const mockServer = {
        registerPrompt: mockRegisterPrompt,
      } as unknown as McpServer;

      registerPrompts(mockServer);

      const taskBreakdownCall = (
        mockRegisterPrompt.mock.calls as RegisterPromptCall[]
      ).find((call) => call[0] === "quire.task-breakdown");
      const handler = taskBreakdownCall![2];

      const result = handler({
        taskOid: "abc123",
      });

      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(1);
      const message = result.messages[0]!;
      expect(message.content.text).toContain("abc123");
    });

    it("should return correct message structure for weekly-summary", () => {
      const mockRegisterPrompt = vi.fn();
      const mockServer = {
        registerPrompt: mockRegisterPrompt,
      } as unknown as McpServer;

      registerPrompts(mockServer);

      const weeklySummaryCall = (
        mockRegisterPrompt.mock.calls as RegisterPromptCall[]
      ).find((call) => call[0] === "quire.weekly-summary");
      const handler = weeklySummaryCall![2];

      const result = handler({
        projectId: "test-project",
      });

      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(1);
      const message = result.messages[0]!;
      expect(message.content.text).toContain("test-project");
    });
  });
});
