import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { QuireClient } from "../quire/client.js";
import {
  createProjectIdCompleter,
  createOrganizationIdCompleter,
  clearCompletionCache,
} from "./completions.js";

// Mock the client factory
vi.mock("../quire/client.js", () => ({
  createClientFromAuth: vi.fn(),
}));

import { createClientFromAuth } from "../quire/client.js";

describe("Resource Completions", () => {
  let mockClient: Partial<QuireClient>;
  let mockCreateClientFromAuth: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCompletionCache(); // Clear cache before each test

    mockClient = {
      listProjects: vi.fn(),
      listOrganizations: vi.fn(),
    };

    mockCreateClientFromAuth = createClientFromAuth as Mock;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createProjectIdCompleter", () => {
    it("should return empty array when auth fails", async () => {
      mockCreateClientFromAuth.mockResolvedValue({
        success: false,
        error: { code: "UNAUTHORIZED", message: "No auth" },
      });

      const completer = createProjectIdCompleter();
      const result = await completer("test");

      expect(result).toEqual([]);
      expect(mockClient.listProjects).not.toHaveBeenCalled();
    });

    it("should return empty array when API call fails", async () => {
      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listProjects as Mock).mockResolvedValue({
        success: false,
        error: { code: "SERVER_ERROR", message: "API error" },
      });

      const completer = createProjectIdCompleter();
      const result = await completer("test");

      expect(result).toEqual([]);
    });

    it("should return all project IDs with empty search string (max 20)", async () => {
      const projects = Array.from({ length: 30 }, (_, i) => ({
        id: `proj-${i}`,
        name: `Project ${i}`,
      }));

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listProjects as Mock).mockResolvedValue({
        success: true,
        data: projects,
      });

      const completer = createProjectIdCompleter();
      const result = await completer("");

      expect(result).toHaveLength(20); // MAX_SUGGESTIONS = 20
      expect(result[0]).toBe("proj-0");
      expect(result[19]).toBe("proj-19");
    });

    it("should filter projects by partial ID match", async () => {
      const projects = [
        { id: "proj-alpha", name: "Alpha Project" },
        { id: "proj-beta", name: "Beta Project" },
        { id: "task-gamma", name: "Gamma Task" },
      ];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listProjects as Mock).mockResolvedValue({
        success: true,
        data: projects,
      });

      const completer = createProjectIdCompleter();
      const result = await completer("proj");

      expect(result).toEqual(["proj-alpha", "proj-beta"]);
    });

    it("should filter projects by partial name match", async () => {
      const projects = [
        { id: "proj-1", name: "Alpha Project" },
        { id: "proj-2", name: "Beta Project" },
        { id: "proj-3", name: "Gamma Task" },
      ];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listProjects as Mock).mockResolvedValue({
        success: true,
        data: projects,
      });

      const completer = createProjectIdCompleter();
      const result = await completer("project");

      expect(result).toEqual(["proj-1", "proj-2"]);
    });

    it("should be case insensitive in filtering", async () => {
      const projects = [
        { id: "proj-alpha", name: "Alpha Project" },
        { id: "proj-beta", name: "Beta Project" },
      ];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listProjects as Mock).mockResolvedValue({
        success: true,
        data: projects,
      });

      const completer = createProjectIdCompleter();
      const result = await completer("ALPHA");

      expect(result).toEqual(["proj-alpha"]);
    });

    it("should use cache on second call", async () => {
      const projects = [{ id: "proj-1", name: "Project 1" }];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listProjects as Mock).mockResolvedValue({
        success: true,
        data: projects,
      });

      const completer = createProjectIdCompleter();

      // First call
      const result1 = await completer("proj");
      expect(result1).toEqual(["proj-1"]);
      expect(mockClient.listProjects).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await completer("proj");
      expect(result2).toEqual(["proj-1"]);
      expect(mockClient.listProjects).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should use stale cache when fresh fetch fails", async () => {
      const projects = [{ id: "proj-1", name: "Project 1" }];

      vi.useFakeTimers();
      const initialTime = Date.now();

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      // First call succeeds
      (mockClient.listProjects as Mock).mockResolvedValueOnce({
        success: true,
        data: projects,
      });

      const completer = createProjectIdCompleter();
      const result1 = await completer("proj");
      expect(result1).toEqual(["proj-1"]);

      // Advance time to expire cache
      vi.setSystemTime(initialTime + 31000); // > 30 second TTL

      // Second call fails with error thrown
      (mockClient.listProjects as Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      // Should return stale cache instead of empty array
      const result2 = await completer("proj");
      expect(result2).toEqual(["proj-1"]);

      vi.useRealTimers();
    });

    it("should refresh cache after TTL expiration", async () => {
      const initialProjects = [{ id: "proj-1", name: "Project 1" }];
      const updatedProjects = [
        { id: "proj-1", name: "Project 1" },
        { id: "proj-2", name: "Project 2" },
      ];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      // First call
      (mockClient.listProjects as Mock).mockResolvedValueOnce({
        success: true,
        data: initialProjects,
      });

      const completer = createProjectIdCompleter();
      const result1 = await completer("");
      expect(result1).toHaveLength(1);

      // Advance time beyond cache TTL
      vi.useFakeTimers();
      vi.advanceTimersByTime(31000); // > 30 second TTL

      // Second call should fetch fresh data
      (mockClient.listProjects as Mock).mockResolvedValueOnce({
        success: true,
        data: updatedProjects,
      });

      const result2 = await completer("");
      expect(result2).toHaveLength(2);
      expect(mockClient.listProjects).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe("createOrganizationIdCompleter", () => {
    it("should return empty array when auth fails", async () => {
      mockCreateClientFromAuth.mockResolvedValue({
        success: false,
        error: { code: "UNAUTHORIZED", message: "No auth" },
      });

      const completer = createOrganizationIdCompleter();
      const result = await completer("test");

      expect(result).toEqual([]);
      expect(mockClient.listOrganizations).not.toHaveBeenCalled();
    });

    it("should return empty array when API call fails", async () => {
      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listOrganizations as Mock).mockResolvedValue({
        success: false,
        error: { code: "SERVER_ERROR", message: "API error" },
      });

      const completer = createOrganizationIdCompleter();
      const result = await completer("test");

      expect(result).toEqual([]);
    });

    it("should return all organization IDs with empty search string (max 20)", async () => {
      const organizations = Array.from({ length: 25 }, (_, i) => ({
        id: `org-${i}`,
        name: `Organization ${i}`,
      }));

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listOrganizations as Mock).mockResolvedValue({
        success: true,
        data: organizations,
      });

      const completer = createOrganizationIdCompleter();
      const result = await completer("");

      expect(result).toHaveLength(20); // MAX_SUGGESTIONS = 20
    });

    it("should filter organizations by partial ID match", async () => {
      const organizations = [
        { id: "org-alpha", name: "Alpha Org" },
        { id: "org-beta", name: "Beta Org" },
        { id: "company-gamma", name: "Gamma Company" },
      ];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listOrganizations as Mock).mockResolvedValue({
        success: true,
        data: organizations,
      });

      const completer = createOrganizationIdCompleter();
      const result = await completer("org");

      expect(result).toEqual(["org-alpha", "org-beta"]);
    });

    it("should filter organizations by partial name match", async () => {
      const organizations = [
        { id: "org-1", name: "Alpha Org" },
        { id: "org-2", name: "Beta Org" },
        { id: "org-3", name: "Gamma Company" },
      ];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listOrganizations as Mock).mockResolvedValue({
        success: true,
        data: organizations,
      });

      const completer = createOrganizationIdCompleter();
      const result = await completer("company");

      expect(result).toEqual(["org-3"]);
    });

    it("should use cache on second call", async () => {
      const organizations = [{ id: "org-1", name: "Organization 1" }];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listOrganizations as Mock).mockResolvedValue({
        success: true,
        data: organizations,
      });

      const completer = createOrganizationIdCompleter();

      // First call
      const result1 = await completer("org");
      expect(result1).toEqual(["org-1"]);
      expect(mockClient.listOrganizations).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await completer("org");
      expect(result2).toEqual(["org-1"]);
      expect(mockClient.listOrganizations).toHaveBeenCalledTimes(1);
    });

    it("should use stale cache when fresh fetch fails", async () => {
      const organizations = [{ id: "org-1", name: "Organization 1" }];

      vi.useFakeTimers();
      const initialTime = Date.now();

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      // First call succeeds
      (mockClient.listOrganizations as Mock).mockResolvedValueOnce({
        success: true,
        data: organizations,
      });

      const completer = createOrganizationIdCompleter();
      const result1 = await completer("org");
      expect(result1).toEqual(["org-1"]);

      // Advance time to expire cache
      vi.setSystemTime(initialTime + 31000);

      // Second call fails with error thrown
      (mockClient.listOrganizations as Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      // Should return stale cache
      const result2 = await completer("org");
      expect(result2).toEqual(["org-1"]);

      vi.useRealTimers();
    });

    it("should return empty array when fetch fails with no cache", async () => {
      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      // Mock fetch to throw an error
      (mockClient.listOrganizations as Mock).mockRejectedValue(
        new Error("Network error")
      );

      const completer = createOrganizationIdCompleter();
      const result = await completer("test");

      // Should return empty array since no cache exists
      expect(result).toEqual([]);
    });
  });

  describe("clearCompletionCache", () => {
    it("should clear cache and force fresh fetch", async () => {
      const projects = [{ id: "proj-1", name: "Project 1" }];

      mockCreateClientFromAuth.mockResolvedValue({
        success: true,
        data: mockClient,
      });

      (mockClient.listProjects as Mock).mockResolvedValue({
        success: true,
        data: projects,
      });

      const completer = createProjectIdCompleter();

      // First call
      await completer("proj");
      expect(mockClient.listProjects).toHaveBeenCalledTimes(1);

      // Clear cache
      clearCompletionCache();

      // Next call should fetch again
      await completer("proj");
      expect(mockClient.listProjects).toHaveBeenCalledTimes(2);
    });
  });
});
