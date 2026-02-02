import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  QuireClient,
  createClientFromEnv,
  createClientFromAuth as _createClientFromAuth,
} from "./client.js";
import { QuireClientError } from "./types.js";

// Helper to create mock responses
function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockTextResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/csv" },
  });
}

describe("QuireClient", () => {
  describe("constructor", () => {
    it("should create a client with required options", () => {
      const client = new QuireClient({ token: "test-token" });
      expect(client).toBeInstanceOf(QuireClient);
    });

    it("should accept custom timeout and maxRetries", () => {
      const client = new QuireClient({
        token: "test-token",
        timeoutMs: 5000,
        maxRetries: 5,
      });
      expect(client).toBeInstanceOf(QuireClient);
    });
  });

  describe("getMe", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should return user data on successful response", async () => {
      const mockUser = {
        id: "123",
        oid: "abc",
        name: "Test User",
        nameText: "Test User",
        email: "test@example.com",
      };

      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(mockUser));

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockUser);
      }
    });

    it("should return UNAUTHORIZED error on 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({ message: "Invalid token" }, 401)
      );

      const client = new QuireClient({ token: "bad-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNAUTHORIZED");
        expect(result.error.statusCode).toBe(401);
        expect(result.error.retryable).toBe(false);
      }
    });

    it("should return FORBIDDEN error on 403", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({ message: "Forbidden" }, 403)
      );

      const client = new QuireClient({ token: "test-token", maxRetries: 0 });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FORBIDDEN");
        expect(result.error.statusCode).toBe(403);
        expect(result.error.retryable).toBe(false);
      }
    });

    it("should return NOT_FOUND error on 404", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({ message: "Not found" }, 404)
      );

      const client = new QuireClient({ token: "test-token", maxRetries: 0 });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.statusCode).toBe(404);
        expect(result.error.retryable).toBe(false);
      }
    });

    it("should return RATE_LIMITED error on 429", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ message: "Rate limited" }, 429)
      );

      const client = new QuireClient({
        token: "test-token",
        maxRetries: 0,
      });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("RATE_LIMITED");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("should return SERVER_ERROR on 503", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ message: "Service unavailable" }, 503)
      );

      const client = new QuireClient({
        token: "test-token",
        maxRetries: 0,
      });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SERVER_ERROR");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("should return SERVER_ERROR on 500", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ message: "Internal server error" }, 500)
      );

      const client = new QuireClient({
        token: "test-token",
        maxRetries: 0,
      });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SERVER_ERROR");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("should return UNKNOWN error on other status codes", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ message: "Bad request" }, 400)
      );

      const client = new QuireClient({
        token: "test-token",
        maxRetries: 0,
      });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNKNOWN");
        expect(result.error.retryable).toBe(false);
      }
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NETWORK_ERROR");
        expect(result.error.message).toBe("Network error");
      }
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Timeout");
      timeoutError.name = "TimeoutError";
      vi.mocked(fetch).mockRejectedValueOnce(timeoutError);

      const client = new QuireClient({ token: "test-token", timeoutMs: 1000 });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("TIMEOUT");
        expect(result.error.retryable).toBe(true);
      }
    });

    it("should handle AbortError", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      vi.mocked(fetch).mockRejectedValueOnce(abortError);

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("TIMEOUT");
      }
    });

    it("should handle non-Error throws", async () => {
      vi.mocked(fetch).mockRejectedValueOnce("String error");

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNKNOWN");
        expect(result.error.message).toBe("Unknown error occurred");
      }
    });

    it("should handle error body without message field", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({ error: "some error" }, 401)
      );

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("HTTP 401");
      }
    });

    it("should handle non-JSON error body", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Not JSON", { status: 401 })
      );

      const client = new QuireClient({ token: "test-token" });
      const result = await client.getMe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("HTTP 401");
      }
    });

    it("should retry on 429 and eventually succeed", async () => {
      vi.useFakeTimers();

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse({ message: "Rate limited" }, 429))
        .mockResolvedValueOnce(
          mockResponse({
            id: "123",
            oid: "abc",
            name: "User",
            nameText: "User",
          })
        );

      const client = new QuireClient({ token: "test-token", maxRetries: 3 });
      const resultPromise = client.getMe();

      // Fast-forward through retry delay
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should retry on 503 and eventually succeed", async () => {
      vi.useFakeTimers();

      vi.mocked(fetch)
        .mockResolvedValueOnce(
          mockResponse({ message: "Service unavailable" }, 503)
        )
        .mockResolvedValueOnce(
          mockResponse({
            id: "123",
            oid: "abc",
            name: "User",
            nameText: "User",
          })
        );

      const client = new QuireClient({ token: "test-token", maxRetries: 3 });
      const resultPromise = client.getMe();

      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should exhaust retries with exponential backoff", async () => {
      vi.useFakeTimers();

      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ message: "Rate limited" }, 429)
      );

      const client = new QuireClient({ token: "test-token", maxRetries: 3 });
      const resultPromise = client.getMe();

      // Retry 1: 1000ms delay
      await vi.advanceTimersByTimeAsync(1000);
      // Retry 2: 2000ms delay
      await vi.advanceTimersByTimeAsync(2000);
      // Retry 3: 4000ms delay
      await vi.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries

      vi.useRealTimers();
    });

    it("should send correct headers with body", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ id: "123" }));

      const client = new QuireClient({ token: "test-token" });
      await client.createTask("my-project", { name: "Test Task" });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/task/id/my-project"),
        expect.objectContaining({
          method: "POST",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            Accept: "application/json",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ name: "Test Task" }),
        })
      );
    });
  });

  // =====================
  // Organization Methods
  // =====================

  describe("Organization Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("listOrganizations", () => {
      it("should list organizations", async () => {
        const mockOrgs = [
          { id: "org1", oid: "abc123", name: "Org 1", nameText: "Org 1" },
        ];
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse(mockOrgs));

        const client = new QuireClient({ token: "test-token" });
        const result = await client.listOrganizations();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(mockOrgs);
        }
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/organization/list"),
          expect.any(Object)
        );
      });
    });

    describe("getOrganization", () => {
      it("should use /organization/id/ endpoint for slug IDs", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-org", oid: "abc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getOrganization("my-org");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/organization/id/my-org"),
          expect.any(Object)
        );
      });

      it("should use /organization/ endpoint for OIDs with dots", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-org", oid: "abc.def" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getOrganization("abc.def");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/organization/abc.def"),
          expect.any(Object)
        );
        expect(fetch).toHaveBeenCalledWith(
          expect.not.stringContaining("/organization/id/"),
          expect.any(Object)
        );
      });

      it("should use /organization/ endpoint for OIDs with uppercase", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-org", oid: "AbC123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getOrganization("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/organization/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("updateOrganization", () => {
      it("should update organization with ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-org", oid: "abc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateOrganization("my-org", { addFollowers: ["user1"] });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/organization/id/my-org"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ addFollowers: ["user1"] }),
          })
        );
      });

      it("should update organization with OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-org", oid: "AbC123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateOrganization("AbC123", {
          removeFollowers: ["user1"],
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/organization/AbC123"),
          expect.objectContaining({ method: "PUT" })
        );
      });
    });
  });

  // =====================
  // Project Methods
  // =====================

  describe("Project Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("listProjects", () => {
      it("should list all projects without organization filter", async () => {
        const mockProjects = [
          {
            id: "proj1",
            oid: "abc123",
            name: "Project 1",
            nameText: "Project 1",
          },
        ];
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse(mockProjects));

        const client = new QuireClient({ token: "test-token" });
        const result = await client.listProjects();

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/list"),
          expect.any(Object)
        );
        expect(fetch).not.toHaveBeenCalledWith(
          expect.stringContaining("/project/list/"),
          expect.any(Object)
        );
      });

      it("should list projects filtered by organization ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listProjects("my-org");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/list/id/my-org"),
          expect.any(Object)
        );
      });

      it("should list projects filtered by organization OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listProjects("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/list/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("getProject", () => {
      it("should get project by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({
            id: "my-project",
            oid: "abc",
            name: "My Project",
            nameText: "My Project",
          })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getProject("my-project");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/id/my-project"),
          expect.any(Object)
        );
      });

      it("should get project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-project", oid: "AbC123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getProject("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("updateProject", () => {
      it("should update project by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-project", oid: "abc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateProject("my-project", { name: "New Name" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/id/my-project"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "New Name" }),
          })
        );
      });

      it("should update project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "my-project", oid: "AbC123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateProject("AbC123", { description: "New desc" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/AbC123"),
          expect.objectContaining({ method: "PUT" })
        );
      });
    });

    describe("exportProject", () => {
      it("should export project as JSON by ID", async () => {
        const mockTasks = [
          { oid: "task1", id: 1, name: "Task 1", nameText: "Task 1" },
        ];
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse(mockTasks));

        const client = new QuireClient({ token: "test-token" });
        const result = await client.exportProject("my-project", "json");

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/export-json/id/my-project"),
          expect.any(Object)
        );
      });

      it("should export project as JSON by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.exportProject("AbC123", "json");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/export-json/AbC123"),
          expect.any(Object)
        );
      });

      it("should export project as CSV by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockTextResponse("id,name\n1,Task 1")
        );

        const client = new QuireClient({ token: "test-token" });
        const result = await client.exportProject("my-project", "csv");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("id,name\n1,Task 1");
        }
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/export-csv/id/my-project"),
          expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            headers: expect.objectContaining({
              Accept: "text/csv",
            }),
          })
        );
      });

      it("should export project as CSV by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockTextResponse("id,name\n1,Task 1")
        );

        const client = new QuireClient({ token: "test-token" });
        await client.exportProject("AbC123", "csv");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/export-csv/AbC123"),
          expect.any(Object)
        );
      });

      it("should handle CSV export errors", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response("Forbidden", { status: 403 })
        );

        const client = new QuireClient({ token: "test-token" });
        const result = await client.exportProject("my-project", "csv");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("FORBIDDEN");
        }
      });

      it("should handle CSV export network errors", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

        const client = new QuireClient({ token: "test-token" });
        const result = await client.exportProject("my-project", "csv");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("NETWORK_ERROR");
        }
      });

      it("should handle CSV export non-Error throws", async () => {
        vi.mocked(fetch).mockRejectedValueOnce("String error");

        const client = new QuireClient({ token: "test-token" });
        const result = await client.exportProject("my-project", "csv");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("UNKNOWN");
        }
      });

      it("should default to JSON export", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.exportProject("my-project");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/project/export-json/"),
          expect.any(Object)
        );
      });
    });
  });

  // =====================
  // Task Methods
  // =====================

  describe("Task Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("listTasks", () => {
      it("should list root tasks in project by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTasks("my-project");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/list/id/my-project"),
          expect.any(Object)
        );
      });

      it("should list root tasks in project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTasks("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/list/AbC123"),
          expect.any(Object)
        );
      });

      it("should list subtasks when parentTaskOid is provided", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTasks("my-project", "ParentOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/list/ParentOid123"),
          expect.any(Object)
        );
      });
    });

    describe("getTask", () => {
      it("should get task by project ID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 123, oid: "abc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getTask("my-project", 123);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/id/my-project/123"),
          expect.any(Object)
        );
      });

      it("should get task by project OID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 123, oid: "abc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getTask("AbC123", 456);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/AbC123/456"),
          expect.any(Object)
        );
      });

      it("should get task by OID when taskId is not provided", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 123, oid: "TaskOid123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getTask("TaskOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/TaskOid123"),
          expect.any(Object)
        );
      });
    });

    describe("createTask", () => {
      it("should create task by project ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 1, name: "New Task" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createTask("my-project", { name: "New Task" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/id/my-project"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "New Task" }),
          })
        );
      });

      it("should create task by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 1, name: "New Task" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createTask("AbC123", { name: "New Task" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/AbC123"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("should filter undefined values from params", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 1, name: "New Task" })
        );

        const client = new QuireClient({ token: "test-token" });
        const params = {
          name: "New Task",
          description: undefined,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        await client.createTask("my-project", params as any);

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ name: "New Task" }),
          })
        );
      });
    });

    describe("updateTask", () => {
      it("should update task by project ID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 123, name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateTask("my-project", 123, { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/id/my-project/123"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "Updated" }),
          })
        );
      });

      it("should update task by project OID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 123, name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateTask("AbC123", 456, { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/AbC123/456"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should update task by OID when params passed directly", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 123, name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateTask("TaskOid123", { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/TaskOid123"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should handle empty params when updating by task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 123, name: "Task" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateTask("my-project", 123);

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({}),
          })
        );
      });
    });

    describe("deleteTask", () => {
      it("should delete task by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "TaskOid123" })
        );

        const client = new QuireClient({ token: "test-token" });
        const result = await client.deleteTask("TaskOid123");

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/TaskOid123"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    describe("searchTasks", () => {
      it("should search tasks by project ID with keyword", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchTasks("my-project", "bug");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/search/id/my-project?keyword=bug"),
          expect.any(Object)
        );
      });

      it("should search tasks by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchTasks("AbC123", "feature");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/search/AbC123?keyword=feature"),
          expect.any(Object)
        );
      });

      it("should include all search options in query string", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchTasks("my-project", "test", {
          status: 100,
          priority: 1,
          assigneeId: "user123",
          tagId: 5,
        });

        const call = vi.mocked(fetch).mock.calls[0];
        expect(call).toBeDefined();
        const url = call?.[0] as string;
        expect(url).toContain("keyword=test");
        expect(url).toContain("status=100");
        expect(url).toContain("priority=1");
        expect(url).toContain("assignee=user123");
        expect(url).toContain("tag=5");
      });
    });

    describe("createTaskAfter", () => {
      it("should create task after specified task OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 2, name: "After Task" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createTaskAfter("TaskOid123", { name: "After Task" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/after/TaskOid123"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "After Task" }),
          })
        );
      });
    });

    describe("createTaskBefore", () => {
      it("should create task before specified task OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: 2, name: "Before Task" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createTaskBefore("TaskOid123", { name: "Before Task" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/before/TaskOid123"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "Before Task" }),
          })
        );
      });
    });

    describe("searchFolderTasks", () => {
      it("should search folder tasks by folder ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchFolderTasks("my-folder", "keyword");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            "/task/search-folder/id/my-folder?keyword=keyword"
          ),
          expect.any(Object)
        );
      });

      it("should search folder tasks by folder OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchFolderTasks("AbC123", "keyword");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/search-folder/AbC123?keyword=keyword"),
          expect.any(Object)
        );
      });

      it("should include search options", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchFolderTasks("my-folder", "test", {
          status: 100,
          priority: 2,
          assigneeId: "user1",
          tagId: 3,
        });

        const call = vi.mocked(fetch).mock.calls[0];
        expect(call).toBeDefined();
        const url = call?.[0] as string;
        expect(url).toContain("status=100");
        expect(url).toContain("priority=2");
        expect(url).toContain("assignee=user1");
        expect(url).toContain("tag=3");
      });
    });

    describe("searchOrganizationTasks", () => {
      it("should search organization tasks by org ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchOrganizationTasks("my-org", "keyword");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            "/task/search-organization/id/my-org?keyword=keyword"
          ),
          expect.any(Object)
        );
      });

      it("should search organization tasks by org OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchOrganizationTasks("AbC123", "keyword");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            "/task/search-organization/AbC123?keyword=keyword"
          ),
          expect.any(Object)
        );
      });

      it("should include search options", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.searchOrganizationTasks("my-org", "test", {
          status: 0,
          priority: 1,
          assigneeId: "user1",
          tagId: 2,
        });

        const call = vi.mocked(fetch).mock.calls[0];
        expect(call).toBeDefined();
        const url = call?.[0] as string;
        expect(url).toContain("status=0");
        expect(url).toContain("priority=1");
        expect(url).toContain("assignee=user1");
        expect(url).toContain("tag=2");
      });
    });
  });

  // =====================
  // Tag Methods
  // =====================

  describe("Tag Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("listTags", () => {
      it("should list tags by project ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTags("my-project");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/tag/list/id/my-project"),
          expect.any(Object)
        );
      });

      it("should list tags by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTags("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/tag/list/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("getTag", () => {
      it("should get tag by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "TagOid123", name: "Bug" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getTag("TagOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/tag/TagOid123"),
          expect.any(Object)
        );
      });
    });

    describe("createTag", () => {
      it("should create tag by project ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "newTag", name: "Feature" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createTag("my-project", { name: "Feature", color: "0" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/tag/id/my-project"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "Feature", color: "0" }),
          })
        );
      });

      it("should create tag by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "newTag", name: "Feature" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createTag("AbC123", { name: "Feature" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/tag/AbC123"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    describe("updateTag", () => {
      it("should update tag by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "TagOid123", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateTag("TagOid123", { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/tag/TagOid123"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "Updated" }),
          })
        );
      });
    });

    describe("deleteTag", () => {
      it("should delete tag by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "TagOid123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.deleteTag("TagOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/tag/TagOid123"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });
  });

  // =====================
  // Comment Methods
  // =====================

  describe("Comment Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("listTaskComments", () => {
      it("should list comments by task OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTaskComments("TaskOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/list/task/TaskOid123"),
          expect.any(Object)
        );
      });

      it("should list comments by project ID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTaskComments("my-project", 123);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/list/id/my-project/task/123"),
          expect.any(Object)
        );
      });

      it("should list comments by project OID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listTaskComments("AbC123", 456);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/list/AbC123/task/456"),
          expect.any(Object)
        );
      });
    });

    describe("addTaskComment", () => {
      it("should add comment by task OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "Test" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addTaskComment("TaskOid123", { description: "Test" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/task/TaskOid123"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ description: "Test" }),
          })
        );
      });

      it("should add comment by project ID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "Test" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addTaskComment("my-project", 123, { description: "Test" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/id/my-project/task/123"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("should add comment by project OID and task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "Test" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addTaskComment("AbC123", 456, { description: "Test" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/AbC123/task/456"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("should handle empty params when adding by task number", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addTaskComment("my-project", 123);

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({}),
          })
        );
      });
    });

    describe("updateComment", () => {
      it("should update comment by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateComment("comment1", { description: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/comment1"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ description: "Updated" }),
          })
        );
      });
    });

    describe("deleteComment", () => {
      it("should delete comment by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.deleteComment("comment1");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/comment1"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    describe("listChatComments", () => {
      it("should list chat comments by chat OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listChatComments("ChatOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/list/chat/ChatOid123"),
          expect.any(Object)
        );
      });

      it("should list chat comments by project ID and chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listChatComments("my-project", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/list/id/my-project/chat/general"),
          expect.any(Object)
        );
      });

      it("should list chat comments by project OID and chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listChatComments("AbC123", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/list/AbC123/chat/general"),
          expect.any(Object)
        );
      });
    });

    describe("addChatComment", () => {
      it("should add chat comment by chat OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "Hello" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addChatComment("ChatOid123", { description: "Hello" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/chat/ChatOid123"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ description: "Hello" }),
          })
        );
      });

      it("should add chat comment by project ID and chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "Hello" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addChatComment("my-project", "general", {
          description: "Hello",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/id/my-project/chat/general"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("should add chat comment by project OID and chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "Hello" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addChatComment("AbC123", "general", {
          description: "Hello",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/AbC123/chat/general"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("should handle missing params when adding by chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "comment1", description: "" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.addChatComment("my-project", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({}),
          })
        );
      });
    });
  });

  // =====================
  // User Methods
  // =====================

  describe("User Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("getUser", () => {
      it("should get user by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "john_doe", oid: "abc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getUser("john_doe");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/user/id/john_doe"),
          expect.any(Object)
        );
      });

      it("should get user by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ id: "john", oid: "AbC123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getUser("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/user/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("listUsers", () => {
      it("should list all users", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listUsers();

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/user/list"),
          expect.any(Object)
        );
      });
    });

    describe("listProjectMembers", () => {
      it("should list members by project ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listProjectMembers("my-project");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/user/list/project/id/my-project"),
          expect.any(Object)
        );
      });

      it("should list members by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listProjectMembers("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/user/list/project/AbC123"),
          expect.any(Object)
        );
      });
    });
  });

  // =====================
  // Status Methods
  // =====================

  describe("Status Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("listStatuses", () => {
      it("should list statuses by project ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listStatuses("my-project");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/list/id/my-project"),
          expect.any(Object)
        );
      });

      it("should list statuses by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listStatuses("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/list/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("getStatus", () => {
      it("should get status by project ID and value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ value: 100, name: "Active" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getStatus("my-project", 100);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/id/my-project/100"),
          expect.any(Object)
        );
      });

      it("should get status by project OID and value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ value: 100, name: "Active" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getStatus("AbC123", 100);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/AbC123/100"),
          expect.any(Object)
        );
      });
    });

    describe("createStatus", () => {
      it("should create status by project ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ value: 200, name: "Review" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createStatus("my-project", { name: "Review" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/id/my-project"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "Review" }),
          })
        );
      });

      it("should create status by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ value: 200, name: "Review" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createStatus("AbC123", { name: "Review" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/AbC123"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    describe("updateStatus", () => {
      it("should update status by project ID and value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ value: 100, name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateStatus("my-project", 100, { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/id/my-project/100"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "Updated" }),
          })
        );
      });

      it("should update status by project OID and value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ value: 100, name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateStatus("AbC123", 100, { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/AbC123/100"),
          expect.objectContaining({ method: "PUT" })
        );
      });
    });

    describe("deleteStatus", () => {
      it("should delete status by project ID and value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ value: 100 }));

        const client = new QuireClient({ token: "test-token" });
        await client.deleteStatus("my-project", 100);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/id/my-project/100"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("should delete status by project OID and value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ value: 100 }));

        const client = new QuireClient({ token: "test-token" });
        await client.deleteStatus("AbC123", 100);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/status/AbC123/100"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });
  });

  // =====================
  // Partner Methods
  // =====================

  describe("Partner Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("getPartner", () => {
      it("should get partner by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "PartnerOid123", name: "External Team" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getPartner("PartnerOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/partner/PartnerOid123"),
          expect.any(Object)
        );
      });
    });

    describe("listPartners", () => {
      it("should list partners by project ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listPartners("my-project");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/partner/list/id/my-project"),
          expect.any(Object)
        );
      });

      it("should list partners by project OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listPartners("AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/partner/list/AbC123"),
          expect.any(Object)
        );
      });
    });
  });

  // =====================
  // Document Methods
  // =====================

  describe("Document Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("createDocument", () => {
      it("should create document for organization by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Doc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createDocument("organization", "my-org", {
          name: "Doc",
          content: "Content",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/id/organization/my-org"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "Doc", content: "Content" }),
          })
        );
      });

      it("should create document for organization by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Doc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createDocument("organization", "AbC123", { name: "Doc" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/organization/AbC123"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("should create document for project by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Doc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createDocument("project", "my-project", { name: "Doc" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/id/project/my-project"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    describe("getDocument", () => {
      it("should get document by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "DocOid123", name: "Doc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getDocument("DocOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/DocOid123"),
          expect.any(Object)
        );
      });

      it("should get document by owner type, owner ID, and doc ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Doc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getDocument("project", "my-project", "readme");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/id/project/my-project/readme"),
          expect.any(Object)
        );
      });

      it("should get document by owner type, owner OID, and doc ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Doc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getDocument("project", "AbC123", "readme");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/project/AbC123/readme"),
          expect.any(Object)
        );
      });
    });

    describe("listDocuments", () => {
      it("should list documents for organization by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listDocuments("organization", "my-org");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/list/id/organization/my-org"),
          expect.any(Object)
        );
      });

      it("should list documents for project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listDocuments("project", "AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/list/project/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("updateDocument", () => {
      it("should update document by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "DocOid123", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateDocument("DocOid123", { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/DocOid123"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "Updated" }),
          })
        );
      });

      it("should update document by owner type, owner ID, doc ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateDocument("project", "my-project", "readme", {
          name: "Updated",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/id/project/my-project/readme"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should update document by owner type, owner OID, doc ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateDocument("project", "AbC123", "readme", {
          content: "New content",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/project/AbC123/readme"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should handle missing params when updating by full path", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "doc1", name: "Doc" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateDocument("project", "my-project", "readme");

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({}),
          })
        );
      });
    });

    describe("deleteDocument", () => {
      it("should delete document by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "DocOid123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.deleteDocument("DocOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/DocOid123"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("should delete document by owner type, owner ID, doc ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ oid: "doc1" }));

        const client = new QuireClient({ token: "test-token" });
        await client.deleteDocument("project", "my-project", "readme");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/id/project/my-project/readme"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("should delete document by owner type, owner OID, doc ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ oid: "doc1" }));

        const client = new QuireClient({ token: "test-token" });
        await client.deleteDocument("project", "AbC123", "readme");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/doc/project/AbC123/readme"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });
  });

  // =====================
  // Sublist Methods
  // =====================

  describe("Sublist Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("createSublist", () => {
      it("should create sublist for organization by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1", name: "Sprint 1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createSublist("organization", "my-org", {
          name: "Sprint 1",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/id/organization/my-org"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "Sprint 1" }),
          })
        );
      });

      it("should create sublist for project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1", name: "Sprint 1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createSublist("project", "AbC123", { name: "Sprint 1" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/project/AbC123"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    describe("getSublist", () => {
      it("should get sublist by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "SublistOid123", name: "Sprint 1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getSublist("SublistOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/SublistOid123"),
          expect.any(Object)
        );
      });

      it("should get sublist by owner type, owner ID, sublist ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1", name: "Sprint 1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getSublist("project", "my-project", "sprint-1");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/id/project/my-project/sprint-1"),
          expect.any(Object)
        );
      });

      it("should get sublist by owner type, owner OID, sublist ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1", name: "Sprint 1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getSublist("project", "AbC123", "sprint-1");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/project/AbC123/sprint-1"),
          expect.any(Object)
        );
      });
    });

    describe("listSublists", () => {
      it("should list sublists for organization by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listSublists("organization", "my-org");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/list/id/organization/my-org"),
          expect.any(Object)
        );
      });

      it("should list sublists for project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listSublists("project", "AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/list/project/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("updateSublist", () => {
      it("should update sublist by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "SublistOid123", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateSublist("SublistOid123", { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/SublistOid123"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "Updated" }),
          })
        );
      });

      it("should update sublist by owner type, owner ID, sublist ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateSublist("project", "my-project", "sprint-1", {
          name: "Updated",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/id/project/my-project/sprint-1"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should update sublist by owner type, owner OID, sublist ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateSublist("project", "AbC123", "sprint-1", {
          description: "New desc",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/project/AbC123/sprint-1"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should handle missing params when updating by full path", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1", name: "Sprint" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateSublist("project", "my-project", "sprint-1");

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({}),
          })
        );
      });
    });

    describe("deleteSublist", () => {
      it("should delete sublist by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "SublistOid123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.deleteSublist("SublistOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/SublistOid123"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("should delete sublist by owner type, owner ID, sublist ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.deleteSublist("project", "my-project", "sprint-1");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/id/project/my-project/sprint-1"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("should delete sublist by owner type, owner OID, sublist ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "sublist1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.deleteSublist("project", "AbC123", "sprint-1");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sublist/project/AbC123/sprint-1"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });
  });

  // =====================
  // Chat Methods
  // =====================

  describe("Chat Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("createChat", () => {
      it("should create chat for organization by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "chat1", name: "General" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createChat("organization", "my-org", { name: "General" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/id/organization/my-org"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "General" }),
          })
        );
      });

      it("should create chat for project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "chat1", name: "General" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.createChat("project", "AbC123", { name: "General" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/project/AbC123"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    describe("getChat", () => {
      it("should get chat by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "ChatOid123", name: "General" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getChat("ChatOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/ChatOid123"),
          expect.any(Object)
        );
      });

      it("should get chat by owner type, owner ID, chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "chat1", name: "General" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getChat("project", "my-project", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/id/project/my-project/general"),
          expect.any(Object)
        );
      });

      it("should get chat by owner type, owner OID, chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "chat1", name: "General" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getChat("project", "AbC123", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/project/AbC123/general"),
          expect.any(Object)
        );
      });
    });

    describe("listChats", () => {
      it("should list chats for organization by ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listChats("organization", "my-org");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/list/id/organization/my-org"),
          expect.any(Object)
        );
      });

      it("should list chats for project by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listChats("project", "AbC123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/list/project/AbC123"),
          expect.any(Object)
        );
      });
    });

    describe("updateChat", () => {
      it("should update chat by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "ChatOid123", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateChat("ChatOid123", { name: "Updated" });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/ChatOid123"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ name: "Updated" }),
          })
        );
      });

      it("should update chat by owner type, owner ID, chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "chat1", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateChat("project", "my-project", "general", {
          name: "Updated",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/id/project/my-project/general"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should update chat by owner type, owner OID, chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "chat1", name: "Updated" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateChat("project", "AbC123", "general", {
          description: "New desc",
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/project/AbC123/general"),
          expect.objectContaining({ method: "PUT" })
        );
      });

      it("should handle missing params when updating by full path", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "chat1", name: "Chat" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.updateChat("project", "my-project", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({}),
          })
        );
      });
    });

    describe("deleteChat", () => {
      it("should delete chat by OID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ oid: "ChatOid123" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.deleteChat("ChatOid123");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/ChatOid123"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("should delete chat by owner type, owner ID, chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ oid: "chat1" }));

        const client = new QuireClient({ token: "test-token" });
        await client.deleteChat("project", "my-project", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/id/project/my-project/general"),
          expect.objectContaining({ method: "DELETE" })
        );
      });

      it("should delete chat by owner type, owner OID, chat ID", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ oid: "chat1" }));

        const client = new QuireClient({ token: "test-token" });
        await client.deleteChat("project", "AbC123", "general");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/project/AbC123/general"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });
  });

  // =====================
  // Storage Methods
  // =====================

  describe("Storage Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("getStorageValue", () => {
      it("should get storage value by name", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "key1", value: "value1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getStorageValue("key1");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/storage/key1"),
          expect.any(Object)
        );
      });

      it("should encode special characters in name", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "key/with/slashes", value: "value" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.getStorageValue("key/with/slashes");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/storage/key%2Fwith%2Fslashes"),
          expect.any(Object)
        );
      });
    });

    describe("listStorageEntries", () => {
      it("should list storage entries by prefix", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse([]));

        const client = new QuireClient({ token: "test-token" });
        await client.listStorageEntries("app:");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/storage/list/app%3A"),
          expect.any(Object)
        );
      });
    });

    describe("putStorageValue", () => {
      it("should put storage value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "key1", value: "new-value" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.putStorageValue("key1", "new-value");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/storage/key1"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ value: "new-value" }),
          })
        );
      });

      it("should handle object values", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "key1", value: { foo: "bar" } })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.putStorageValue("key1", { foo: "bar" });

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ value: { foo: "bar" } }),
          })
        );
      });
    });

    describe("deleteStorageValue", () => {
      it("should delete storage value", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ name: "key1" }));

        const client = new QuireClient({ token: "test-token" });
        await client.deleteStorageValue("key1");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/storage/key1"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });
  });

  // =====================
  // Notification Methods
  // =====================

  describe("Notification Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("sendNotification", () => {
      it("should send notification", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ success: true }));

        const client = new QuireClient({ token: "test-token" });
        await client.sendNotification({
          message: "Hello!",
          userIds: ["user1", "user2"],
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/notification"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              message: "Hello!",
              userIds: ["user1", "user2"],
            }),
          })
        );
      });

      it("should filter undefined values from params", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ success: true }));

        const client = new QuireClient({ token: "test-token" });
        const params = {
          message: "Hello!",
          userIds: ["user1"],
          url: undefined,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        await client.sendNotification(params as any);

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              message: "Hello!",
              userIds: ["user1"],
            }),
          })
        );
      });
    });
  });

  // =====================
  // Attachment Methods
  // =====================

  describe("Attachment Methods", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("uploadTaskAttachment", () => {
      it("should upload attachment to task", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "file.txt", length: 12, url: "https://quire.io/file.txt", oid: "attach1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.uploadTaskAttachment(
          "TaskOid123",
          "file.txt",
          "file content"
        );

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/attach/TaskOid123/file.txt"),
          expect.objectContaining({
            method: "POST",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
              "Content-Type": "application/octet-stream",
            }),
            body: "file content",
          })
        );
      });

      it("should use custom mime type", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "file.json", length: 15, url: "https://quire.io/file.json", oid: "attach1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.uploadTaskAttachment(
          "TaskOid123",
          "file.json",
          '{"key":"value"}',
          "application/json"
        );

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          })
        );
      });

      it("should encode filename with special characters", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "file name.txt", length: 10, url: "https://quire.io/file%20name.txt", oid: "attach1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.uploadTaskAttachment(
          "TaskOid123",
          "file name.txt",
          "content"
        );

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/task/attach/TaskOid123/file%20name.txt"),
          expect.any(Object)
        );
      });

      it("should handle upload errors", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ message: "File too large" }, 413)
        );

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadTaskAttachment(
          "TaskOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe("File too large");
        }
      });

      it("should handle upload errors without message", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response("Not JSON", { status: 413 })
        );

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadTaskAttachment(
          "TaskOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe("HTTP 413");
        }
      });

      it("should handle timeout errors", async () => {
        const timeoutError = new Error("Timeout");
        timeoutError.name = "TimeoutError";
        vi.mocked(fetch).mockRejectedValueOnce(timeoutError);

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadTaskAttachment(
          "TaskOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("TIMEOUT");
        }
      });

      it("should handle network errors", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadTaskAttachment(
          "TaskOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("NETWORK_ERROR");
        }
      });

      it("should handle non-Error throws", async () => {
        vi.mocked(fetch).mockRejectedValueOnce("String error");

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadTaskAttachment(
          "TaskOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("UNKNOWN");
        }
      });
    });

    describe("uploadCommentAttachment", () => {
      it("should upload attachment to comment", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "file.txt", length: 12, url: "https://quire.io/file.txt", oid: "attach1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.uploadCommentAttachment(
          "CommentOid123",
          "file.txt",
          "file content"
        );

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/comment/attach/CommentOid123/file.txt"),
          expect.objectContaining({
            method: "POST",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
              "Content-Type": "application/octet-stream",
            }),
            body: "file content",
          })
        );
      });

      it("should use custom mime type", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ name: "image.png", length: 20, url: "https://quire.io/image.png", oid: "attach1" })
        );

        const client = new QuireClient({ token: "test-token" });
        await client.uploadCommentAttachment(
          "CommentOid123",
          "image.png",
          "binary data",
          "image/png"
        );

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            headers: expect.objectContaining({
              "Content-Type": "image/png",
            }),
          })
        );
      });

      it("should handle upload errors", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          mockResponse({ message: "Forbidden" }, 403)
        );

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadCommentAttachment(
          "CommentOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("FORBIDDEN");
        }
      });

      it("should handle upload errors without message", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response("Not JSON", { status: 500 })
        );

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadCommentAttachment(
          "CommentOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe("HTTP 500");
        }
      });

      it("should handle AbortError", async () => {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        vi.mocked(fetch).mockRejectedValueOnce(abortError);

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadCommentAttachment(
          "CommentOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("TIMEOUT");
        }
      });

      it("should handle network errors", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadCommentAttachment(
          "CommentOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("NETWORK_ERROR");
        }
      });

      it("should handle non-Error throws", async () => {
        vi.mocked(fetch).mockRejectedValueOnce(42);

        const client = new QuireClient({ token: "test-token" });
        const result = await client.uploadCommentAttachment(
          "CommentOid123",
          "file.txt",
          "content"
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("UNKNOWN");
        }
      });
    });
  });
});

describe("createClientFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return error when QUIRE_ACCESS_TOKEN is not set", () => {
    delete process.env["QUIRE_ACCESS_TOKEN"];

    const result = createClientFromEnv();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(QuireClientError);
      expect(result.error.code).toBe("MISSING_TOKEN");
    }
  });

  it("should create client when QUIRE_ACCESS_TOKEN is set", () => {
    process.env["QUIRE_ACCESS_TOKEN"] = "test-token";

    const result = createClientFromEnv();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(QuireClient);
    }
  });
});

describe("createClientFromAuth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return client on successful auth", async () => {
    vi.doMock("./auth.js", () => ({
      getQuireAccessToken: vi.fn().mockResolvedValue({
        accessToken: "test-token",
      }),
      QuireAuthError: class QuireAuthError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "QuireAuthError";
        }
      },
    }));

    const { createClientFromAuth: createClientFromAuthMocked } =
      await import("./client.js");
    const result = await createClientFromAuthMocked();

    expect(result.success).toBe(true);
    if (result.success) {
      // Due to vi.doMock creating separate module instances, we can't use toBeInstanceOf
      // Instead, we verify the client has expected properties/methods
      expect(result.data).toHaveProperty("token", "test-token");
      expect(typeof result.data.getMe).toBe("function");
    }
  });

  it("should return MISSING_TOKEN error on QuireAuthError", async () => {
    class QuireAuthError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "QuireAuthError";
      }
    }

    vi.doMock("./auth.js", () => ({
      getQuireAccessToken: vi
        .fn()
        .mockRejectedValue(new QuireAuthError("No token available")),
      QuireAuthError,
    }));

    const { createClientFromAuth: createClientFromAuthMocked } =
      await import("./client.js");
    const result = await createClientFromAuthMocked();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("MISSING_TOKEN");
      expect(result.error.message).toBe("No token available");
    }
  });

  it("should return UNKNOWN error on generic Error", async () => {
    vi.doMock("./auth.js", () => ({
      getQuireAccessToken: vi
        .fn()
        .mockRejectedValue(new Error("Something went wrong")),
      QuireAuthError: class QuireAuthError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "QuireAuthError";
        }
      },
    }));

    const { createClientFromAuth: createClientFromAuthMocked } =
      await import("./client.js");
    const result = await createClientFromAuthMocked();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message).toBe("Something went wrong");
    }
  });

  it("should return UNKNOWN error on non-Error throw", async () => {
    vi.doMock("./auth.js", () => ({
      getQuireAccessToken: vi.fn().mockRejectedValue("String error"),
      QuireAuthError: class QuireAuthError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "QuireAuthError";
        }
      },
    }));

    const { createClientFromAuth: createClientFromAuthMocked } =
      await import("./client.js");
    const result = await createClientFromAuthMocked();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message).toBe("Unknown authentication error");
    }
  });
});
