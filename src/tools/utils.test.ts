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
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.type).toBe("text");
      expect(content.text).toContain("UNAUTHORIZED");
      expect(content.text).toContain("invalid or expired");
      expect(content.text).not.toContain("Original");
    });

    it("should format FORBIDDEN error with custom message", () => {
      const result = formatError({ code: "FORBIDDEN", message: "Original" });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toContain("FORBIDDEN");
      expect(content.text).toContain("does not have permission");
    });

    it("should format RATE_LIMITED error with custom message", () => {
      const result = formatError({ code: "RATE_LIMITED", message: "Original" });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toContain("RATE_LIMITED");
      expect(content.text).toContain("rate limit");
    });

    it("should format NOT_FOUND error with resource type", () => {
      const result = formatError(
        { code: "NOT_FOUND", message: "Original" },
        "task"
      );

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toContain("NOT_FOUND");
      expect(content.text).toContain("task was not found");
    });

    it("should format NOT_FOUND error without resource type", () => {
      const result = formatError({ code: "NOT_FOUND", message: "Not found" });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toContain("NOT_FOUND");
      expect(content.text).toContain("Not found");
    });

    it("should use original message for unknown error codes", () => {
      const result = formatError({
        code: "UNKNOWN_ERROR",
        message: "Something went wrong",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toContain("UNKNOWN_ERROR");
      expect(content.text).toContain("Something went wrong");
    });

    it("should format SERVER_ERROR with original message", () => {
      const result = formatError({
        code: "SERVER_ERROR",
        message: "Internal server error",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toContain("SERVER_ERROR");
      expect(content.text).toContain("Internal server error");
    });
  });

  describe("formatAuthError", () => {
    it("should format authentication error", () => {
      const result = formatAuthError("No token available");

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.type).toBe("text");
      expect(content.text).toBe("Authentication Error: No token available");
    });

    it("should handle empty message", () => {
      const result = formatAuthError("");

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toBe("Authentication Error: ");
    });
  });

  describe("formatValidationError", () => {
    it("should format validation error", () => {
      const result = formatValidationError("Invalid input");

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.type).toBe("text");
      expect(content.text).toBe("Error: Invalid input");
    });

    it("should handle complex validation message", () => {
      const result = formatValidationError(
        "Field 'name' is required and must be non-empty"
      );

      expect(result.isError).toBe(true);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toBe(
        "Error: Field 'name' is required and must be non-empty"
      );
    });
  });

  describe("formatSuccess", () => {
    it("should format object data as JSON", () => {
      const data = { id: "123", name: "Test" };
      const result = formatSuccess(data);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.type).toBe("text");
      expect(content.text).toBe(JSON.stringify(data, null, 2));
      expect((result as { isError?: boolean }).isError).toBeUndefined();
    });

    it("should format array data as JSON", () => {
      const data = [
        { id: "1", name: "One" },
        { id: "2", name: "Two" },
      ];
      const result = formatSuccess(data);

      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toBe(JSON.stringify(data, null, 2));
    });

    it("should format primitive data", () => {
      const stringResult = formatSuccess("string");
      expect(stringResult.content[0]).toBeDefined();
      if (!stringResult.content[0])
        throw new Error("Content should be defined");
      expect(stringResult.content[0].text).toBe('"string"');

      const numberResult = formatSuccess(42);
      expect(numberResult.content[0]).toBeDefined();
      if (!numberResult.content[0])
        throw new Error("Content should be defined");
      expect(numberResult.content[0].text).toBe("42");

      const boolResult = formatSuccess(true);
      expect(boolResult.content[0]).toBeDefined();
      if (!boolResult.content[0]) throw new Error("Content should be defined");
      expect(boolResult.content[0].text).toBe("true");

      const nullResult = formatSuccess(null);
      expect(nullResult.content[0]).toBeDefined();
      if (!nullResult.content[0]) throw new Error("Content should be defined");
      expect(nullResult.content[0].text).toBe("null");
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

      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(JSON.parse(content.text)).toEqual(data);
    });
  });

  describe("formatMessage", () => {
    it("should format simple message", () => {
      const result = formatMessage("Operation completed successfully");

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.type).toBe("text");
      expect(content.text).toBe("Operation completed successfully");
      expect((result as { isError?: boolean }).isError).toBeUndefined();
    });

    it("should handle empty message", () => {
      const result = formatMessage("");

      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toBe("");
    });

    it("should handle multiline message", () => {
      const message = "Line 1\nLine 2\nLine 3";
      const result = formatMessage(message);

      expect(result.content[0]).toBeDefined();
      if (!result.content[0]) throw new Error("Content should be defined");
      const content = result.content[0];
      expect(content.text).toBe(message);
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
