/**
 * Test Utilities Tests
 *
 * Tests for the shared test utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  createMockExtra,
  createMockClient,
  mockErrors,
  extractTextContent,
  isErrorResponse,
  type MockExtra,
} from "./__test-utils__.js";

describe("Test Utilities", () => {
  describe("createMockExtra", () => {
    it("should create extra without auth info when no token provided", () => {
      const extra = createMockExtra();

      expect(extra.signal).toBeDefined();
      expect(extra.authInfo).toBeUndefined();
    });

    it("should create extra with auth info when token provided", () => {
      const extra = createMockExtra({ quireToken: "test-token" });

      expect(extra.signal).toBeDefined();
      expect(extra.authInfo).toBeDefined();
      expect(extra.authInfo?.extra?.["quireToken"]).toBe("test-token");
      expect(extra.authInfo?.token).toBe("mcp-token");
      expect(extra.authInfo?.clientId).toBe("test-client");
      expect(extra.authInfo?.scopes).toEqual(["read", "write"]);
    });

    it("should handle empty string token", () => {
      const extra = createMockExtra({ quireToken: "" });

      expect(extra.authInfo?.extra?.["quireToken"]).toBe("");
    });
  });

  describe("createMockClient", () => {
    it("should create mock client with default implementations", () => {
      const client = createMockClient();

      expect(client.getMe.bind(client)).toBeDefined();
      expect(client.getUser.bind(client)).toBeDefined();
      expect(client.listOrganizations.bind(client)).toBeDefined();
      expect(client.listProjects.bind(client)).toBeDefined();
      expect(client.listTasks.bind(client)).toBeDefined();
    });

    it("should allow overriding default implementations", async () => {
      const customResponse = {
        success: true as const,
        data: {
          oid: "custom-oid",
          id: "custom-id",
          name: "Custom User",
          nameText: "Custom User",
          email: "custom@example.com",
          url: "https://quire.io/u/custom",
        },
      };

      const client = createMockClient({
        getMe: () => Promise.resolve(customResponse),
      });

      const result = await client.getMe();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.oid).toBe("custom-oid");
        expect(result.data.name).toBe("Custom User");
      }
    });

    describe("default method implementations", () => {
      it("getMe should return success", async () => {
        const client = createMockClient();
        const result = await client.getMe();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oid).toBe("user-oid");
          expect(result.data.name).toBe("Test User");
        }
      });

      it("getUser should return success", async () => {
        const client = createMockClient();
        const result = await client.getUser("user-id");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oid).toBe("user-oid");
        }
      });

      it("listUsers should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listUsers();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("listOrganizations should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listOrganizations();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("getOrganization should return success", async () => {
        const client = createMockClient();
        const result = await client.getOrganization("org-id");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oid).toBe("org-oid");
        }
      });

      it("listProjects should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listProjects();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("getProject should return success", async () => {
        const client = createMockClient();
        const result = await client.getProject("proj-id");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oid).toBe("project-oid");
        }
      });

      it("listTasks should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listTasks("proj");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("getTask should return success", async () => {
        const client = createMockClient();
        const result = await client.getTask("proj", 1);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oid).toBe("task-oid");
        }
      });

      it("createTask should return success", async () => {
        const client = createMockClient();
        const result = await client.createTask("proj", { name: "New Task" });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("New Task");
        }
      });

      it("updateTask should return success", async () => {
        const client = createMockClient();
        const result = await client.updateTask("proj", 1, {
          name: "Updated",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("Updated Task");
        }
      });

      it("deleteTask should return success", async () => {
        const client = createMockClient();
        const result = await client.deleteTask("task-oid");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oid).toBe("task-oid");
        }
      });

      it("searchTasks should return empty array", async () => {
        const client = createMockClient();
        const result = await client.searchTasks("proj", "test");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("listTags should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listTags("proj");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("getTag should return success", async () => {
        const client = createMockClient();
        const result = await client.getTag("tag-oid");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.oid).toBe("tag-oid");
        }
      });

      it("createTag should return success", async () => {
        const client = createMockClient();
        const result = await client.createTag("proj", { name: "New Tag" });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("New Tag");
        }
      });

      it("listTaskComments should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listTaskComments("task-oid");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("addTaskComment should return success", async () => {
        const client = createMockClient();
        const result = await client.addTaskComment("task-oid", {
          description: "Comment",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBe("Test comment");
        }
      });

      it("listStatuses should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listStatuses("proj");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("getStatus should return success", async () => {
        const client = createMockClient();
        const result = await client.getStatus("proj", 100);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("Active");
        }
      });

      it("createStatus should return success", async () => {
        const client = createMockClient();
        const result = await client.createStatus("proj", {
          name: "New",
          value: 100,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("New Status");
        }
      });

      it("listPartners should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listPartners("proj");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("getPartner should return success", async () => {
        const client = createMockClient();
        const result = await client.getPartner("partner-oid");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("Test Partner");
        }
      });

      it("createDocument should return success", async () => {
        const client = createMockClient();
        const result = await client.createDocument("project", "proj", {
          name: "Doc",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("Test Doc");
        }
      });

      it("listDocuments should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listDocuments("project", "proj");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("createSublist should return success", async () => {
        const client = createMockClient();
        const result = await client.createSublist("project", "proj", {
          name: "Sublist",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("Test Sublist");
        }
      });

      it("listSublists should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listSublists("project", "proj");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("createChat should return success", async () => {
        const client = createMockClient();
        const result = await client.createChat("project", "proj", {
          name: "Chat",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("Test Chat");
        }
      });

      it("listChats should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listChats("project", "proj");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("getStorageValue should return success", async () => {
        const client = createMockClient();
        const result = await client.getStorageValue("key");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.value).toBe("test-value");
        }
      });

      it("listStorageEntries should return empty array", async () => {
        const client = createMockClient();
        const result = await client.listStorageEntries("");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });

      it("sendNotification should return success", async () => {
        const client = createMockClient();
        const result = await client.sendNotification({
          message: "Test",
        });

        expect(result.success).toBe(true);
      });

      it("uploadTaskAttachment should return success", async () => {
        const client = createMockClient();
        const result = await client.uploadTaskAttachment(
          "task-oid",
          "file.txt",
          "data"
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("test-file.txt");
        }
      });
    });
  });

  describe("mockErrors", () => {
    it("unauthorized should return correct error", () => {
      const result = mockErrors.unauthorized();

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.statusCode).toBe(401);
    });

    it("forbidden should return correct error", () => {
      const result = mockErrors.forbidden();

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.statusCode).toBe(403);
    });

    it("notFound should return correct error", () => {
      const result = mockErrors.notFound();

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.statusCode).toBe(404);
    });

    it("rateLimited should return correct error", () => {
      const result = mockErrors.rateLimited();

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.statusCode).toBe(429);
      expect(result.error.retryable).toBe(true);
    });

    it("serverError should return correct error", () => {
      const result = mockErrors.serverError();

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("SERVER_ERROR");
      expect(result.error.statusCode).toBe(500);
      expect(result.error.retryable).toBe(true);
    });

    it("networkError should return correct error", () => {
      const result = mockErrors.networkError();

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NETWORK_ERROR");
      expect(result.error.statusCode).toBeUndefined();
    });

    it("timeout should return correct error", () => {
      const result = mockErrors.timeout();

      expect(result.success).toBe(false);
      expect(result.error.code).toBe("TIMEOUT");
      expect(result.error.statusCode).toBeUndefined();
      expect(result.error.retryable).toBe(true);
    });
  });

  describe("extractTextContent", () => {
    it("should extract text from response", () => {
      const response = {
        content: [{ type: "text", text: "Hello World" }],
      };

      const result = extractTextContent(response);

      expect(result).toBe("Hello World");
    });

    it("should return empty string for undefined response", () => {
      const result = extractTextContent(undefined);

      expect(result).toBe("");
    });

    it("should return empty string if no text content", () => {
      const response = {
        content: [{ type: "image" }],
      };

      const result = extractTextContent(response);

      expect(result).toBe("");
    });

    it("should return first text content if multiple", () => {
      const response = {
        content: [
          { type: "text", text: "First" },
          { type: "text", text: "Second" },
        ],
      };

      const result = extractTextContent(response);

      expect(result).toBe("First");
    });

    it("should handle empty content array", () => {
      const response = {
        content: [],
      };

      const result = extractTextContent(response);

      expect(result).toBe("");
    });
  });

  describe("isErrorResponse", () => {
    it("should return true for error response", () => {
      const response = { isError: true };

      expect(isErrorResponse(response)).toBe(true);
    });

    it("should return false for success response", () => {
      const response = { isError: false };

      expect(isErrorResponse(response)).toBe(false);
    });

    it("should return false for undefined response", () => {
      expect(isErrorResponse(undefined)).toBe(false);
    });

    it("should return false for response without isError", () => {
      const response = { content: [] } as { isError?: boolean };

      expect(isErrorResponse(response)).toBe(false);
    });
  });

  describe("MockExtra type", () => {
    it("should be compatible with RequestHandlerExtra", () => {
      const extra: MockExtra = createMockExtra({ quireToken: "token" });

      expect(extra.signal).toBeInstanceOf(AbortSignal);
      expect(extra.authInfo).toBeDefined();
    });
  });
});
