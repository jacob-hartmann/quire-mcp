import { describe, it, expect } from "vitest";
import { escapeHtml } from "./html.js";

describe("escapeHtml", () => {
  it("should escape ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("should escape less than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("should escape greater than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("should escape double quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("should handle multiple special characters", () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"
    );
  });

  it("should handle mixed content", () => {
    expect(escapeHtml('User "A" & "B" are > "C"')).toBe(
      "User &quot;A&quot; &amp; &quot;B&quot; are &gt; &quot;C&quot;"
    );
  });

  it("should handle empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("should return unchanged string with no special characters", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("should handle string with only special characters", () => {
    expect(escapeHtml("<>&\"")).toBe("&lt;&gt;&amp;&quot;");
  });

  it("should handle repeated special characters", () => {
    expect(escapeHtml("<<<>>>")).toBe("&lt;&lt;&lt;&gt;&gt;&gt;");
  });

  it("should preserve single quotes (not escaped)", () => {
    expect(escapeHtml("It's fine")).toBe("It's fine");
  });

  it("should handle newlines and whitespace", () => {
    expect(escapeHtml("line1\nline2\t<tab>")).toBe(
      "line1\nline2\t&lt;tab&gt;"
    );
  });

  it("should handle HTML entities within content", () => {
    expect(escapeHtml("&amp; is already escaped")).toBe(
      "&amp;amp; is already escaped"
    );
  });
});
