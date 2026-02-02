import { describe, it, expect } from "vitest";
import {
  formatError,
  formatAuthError,
  formatValidationError,
  formatSuccess,
  formatMessage,
  buildParams,
} from "./utils.js";

describe("Tool Utils", () => {
  describe("formatError", () => {
    it("should format UNAUTHORIZED error with custom message", () => {
      const result = formatError({ code: "UNAUTHORIZED", message: "Original" });

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("UNAUTHORIZED");
      expect(result.content[0].text).toContain("invalid or expired");
      expect(result.content[0].text).not.toContain("Original");
    });

    it("should format FORBIDDEN error with custom message", () => {
      const result = formatError({ code: "FORBIDDEN", message: "Original" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("FORBIDDEN");
      expect(result.content[0].text).toContain("does not have permission");
    });

    it("should format RATE_LIMITED error with custom message", () => {
      const result = formatError({ code: "RATE_LIMITED", message: "Original" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("RATE_LIMITED");
      expect(result.content[0].text).toContain("rate limit");
    });

    it("should format NOT_FOUND error with resource type", () => {
      const result = formatError(
        { code: "NOT_FOUND", message: "Original" },
        "task"
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("NOT_FOUND");
      expect(result.content[0].text).toContain("task was not found");
    });

    it("should format NOT_FOUND error without resource type", () => {
      const result = formatError({ code: "NOT_FOUND", message: "Not found" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("NOT_FOUND");
      expect(result.content[0].text).toContain("Not found");
    });

    it("should use original message for unknown error codes", () => {
      const result = formatError({
        code: "UNKNOWN_ERROR",
        message: "Something went wrong",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("UNKNOWN_ERROR");
      expect(result.content[0].text).toContain("Something went wrong");
    });

    it("should format SERVER_ERROR with original message", () => {
      const result = formatError({
        code: "SERVER_ERROR",
        message: "Internal server error",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("SERVER_ERROR");
      expect(result.content[0].text).toContain("Internal server error");
    });
  });

  describe("formatAuthError", () => {
    it("should format authentication error", () => {
      const result = formatAuthError("No token available");

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe(
        "Authentication Error: No token available"
      );
    });

    it("should handle empty message", () => {
      const result = formatAuthError("");

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Authentication Error: ");
    });
  });

  describe("formatValidationError", () => {
    it("should format validation error", () => {
      const result = formatValidationError("Invalid input");

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("Error: Invalid input");
    });

    it("should handle complex validation message", () => {
      const result = formatValidationError(
        "Field 'name' is required and must be non-empty"
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        "Error: Field 'name' is required and must be non-empty"
      );
    });
  });

  describe("formatSuccess", () => {
    it("should format object data as JSON", () => {
      const data = { id: "123", name: "Test" };
      const result = formatSuccess(data);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
      expect((result as { isError?: boolean }).isError).toBeUndefined();
    });

    it("should format array data as JSON", () => {
      const data = [
        { id: "1", name: "One" },
        { id: "2", name: "Two" },
      ];
      const result = formatSuccess(data);

      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    });

    it("should format primitive data", () => {
      expect(formatSuccess("string").content[0].text).toBe('"string"');
      expect(formatSuccess(42).content[0].text).toBe("42");
      expect(formatSuccess(true).content[0].text).toBe("true");
      expect(formatSuccess(null).content[0].text).toBe("null");
    });

    it("should handle nested objects", () => {
      const data = {
        user: {
          id: "123",
          profile: {
            name: "Test",
            settings: {
              theme: "dark",
            },
          },
        },
      };
      const result = formatSuccess(data);

      expect(JSON.parse(result.content[0].text)).toEqual(data);
    });
  });

  describe("formatMessage", () => {
    it("should format simple message", () => {
      const result = formatMessage("Operation completed successfully");

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("Operation completed successfully");
      expect((result as { isError?: boolean }).isError).toBeUndefined();
    });

    it("should handle empty message", () => {
      const result = formatMessage("");

      expect(result.content[0].text).toBe("");
    });

    it("should handle multiline message", () => {
      const message = "Line 1\nLine 2\nLine 3";
      const result = formatMessage(message);

      expect(result.content[0].text).toBe(message);
    });
  });

  describe("buildParams", () => {
    it("should filter out undefined values", () => {
      const input = {
        name: "Test",
        description: undefined,
        priority: 1,
        tags: undefined,
      };

      const result = buildParams(input);

      expect(result).toEqual({
        name: "Test",
        priority: 1,
      });
      expect("description" in result).toBe(false);
      expect("tags" in result).toBe(false);
    });

    it("should keep null values", () => {
      const input = {
        name: "Test",
        description: null as string | null,
      };

      const result = buildParams(input);

      expect(result).toEqual({
        name: "Test",
        description: null,
      });
    });

    it("should keep empty string values", () => {
      const input = {
        name: "",
        description: undefined,
      };

      const result = buildParams(input);

      expect(result).toEqual({
        name: "",
      });
    });

    it("should keep zero values", () => {
      const input = {
        count: 0,
        priority: undefined,
      };

      const result = buildParams(input);

      expect(result).toEqual({
        count: 0,
      });
    });

    it("should keep false values", () => {
      const input = {
        enabled: false,
        visible: undefined,
      };

      const result = buildParams(input);

      expect(result).toEqual({
        enabled: false,
      });
    });

    it("should handle all undefined values", () => {
      const input = {
        a: undefined,
        b: undefined,
        c: undefined,
      };

      const result = buildParams(input);

      expect(result).toEqual({});
    });

    it("should handle empty object", () => {
      const result = buildParams({});

      expect(result).toEqual({});
    });

    it("should handle complex nested values", () => {
      const input = {
        name: "Test",
        nested: { key: "value" },
        array: [1, 2, 3],
        undef: undefined,
      };

      const result = buildParams(input);

      expect(result).toEqual({
        name: "Test",
        nested: { key: "value" },
        array: [1, 2, 3],
      });
    });
  });
});
