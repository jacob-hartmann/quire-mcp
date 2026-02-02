import { describe, it, expect, vi } from "vitest";
import { LRUCache } from "./lru-cache.js";

describe("LRUCache", () => {
  describe("constructor", () => {
    it("should create cache with specified maxSize", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      expect(cache.size).toBe(0);
    });

    it("should accept onEvict callback", () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>({ maxSize: 2, onEvict });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3"); // Should evict "a"

      expect(onEvict).toHaveBeenCalledWith("a", "1");
    });
  });

  describe("set", () => {
    it("should add items to cache", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      expect(cache.size).toBe(2);
      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("value2");
    });

    it("should update existing key and move to most recent", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("a", "updated"); // Update existing key

      expect(cache.get("a")).toBe("updated");
      expect(cache.size).toBe(2);

      // Add new item to verify "a" is now most recent
      cache.set("c", "3");
      cache.set("d", "4"); // Should evict "b", not "a"

      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
    });

    it("should evict oldest item when maxSize is reached", () => {
      const cache = new LRUCache<string>({ maxSize: 2 });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3"); // Should evict "a"

      expect(cache.size).toBe(2);
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(true);
      expect(cache.has("c")).toBe(true);
    });

    it("should call onEvict when evicting", () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<number>({ maxSize: 2, onEvict });

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      expect(onEvict).toHaveBeenCalledTimes(1);
      expect(onEvict).toHaveBeenCalledWith("a", 1);
    });

    it("should not call onEvict when updating existing key", () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>({ maxSize: 2, onEvict });

      cache.set("a", "1");
      cache.set("a", "updated");

      expect(onEvict).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("should return value for existing key", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });
      cache.set("key", "value");

      expect(cache.get("key")).toBe("value");
    });

    it("should return undefined for non-existent key", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should update access order (move to most recent)", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      // Access "a" to make it most recently used
      cache.get("a");

      // Add new item - should evict "b" (now oldest)
      cache.set("d", "4");

      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
      expect(cache.has("c")).toBe(true);
      expect(cache.has("d")).toBe(true);
    });

    it("should not modify cache for non-existent key", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });
      cache.set("a", "1");

      cache.get("nonexistent");

      expect(cache.size).toBe(1);
    });
  });

  describe("has", () => {
    it("should return true for existing key", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });
      cache.set("key", "value");

      expect(cache.has("key")).toBe(true);
    });

    it("should return false for non-existent key", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      expect(cache.has("nonexistent")).toBe(false);
    });

    it("should NOT update access order", () => {
      const cache = new LRUCache<string>({ maxSize: 2 });

      cache.set("a", "1");
      cache.set("b", "2");

      // Check "a" without updating order
      cache.has("a");

      // Add new item - should still evict "a" (oldest)
      cache.set("c", "3");

      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(true);
    });
  });

  describe("delete", () => {
    it("should remove existing key and return true", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });
      cache.set("key", "value");

      const result = cache.delete("key");

      expect(result).toBe(true);
      expect(cache.has("key")).toBe(false);
      expect(cache.size).toBe(0);
    });

    it("should return false for non-existent key", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      const result = cache.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("size", () => {
    it("should return 0 for empty cache", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      expect(cache.size).toBe(0);
    });

    it("should return correct size after operations", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      cache.set("a", "1");
      expect(cache.size).toBe(1);

      cache.set("b", "2");
      cache.set("c", "3");
      expect(cache.size).toBe(3);

      cache.delete("b");
      expect(cache.size).toBe(2);
    });

    it("should not exceed maxSize", () => {
      const cache = new LRUCache<string>({ maxSize: 2 });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      cache.set("d", "4");

      expect(cache.size).toBe(2);
    });
  });

  describe("entries", () => {
    it("should iterate over all entries", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      const entries = [...cache.entries()];

      expect(entries).toHaveLength(3);
      expect(entries).toContainEqual(["a", "1"]);
      expect(entries).toContainEqual(["b", "2"]);
      expect(entries).toContainEqual(["c", "3"]);
    });

    it("should return entries in LRU order (oldest first)", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      // Access "a" to make it most recent
      cache.get("a");

      const entries = [...cache.entries()];

      // Order should be: b (oldest), c, a (most recent)
      expect(entries[0]).toEqual(["b", "2"]);
      expect(entries[1]).toEqual(["c", "3"]);
      expect(entries[2]).toEqual(["a", "1"]);
    });

    it("should return empty iterator for empty cache", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      const entries = [...cache.entries()];

      expect(entries).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      const cache = new LRUCache<string>({ maxSize: 5 });

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(false);
      expect(cache.has("c")).toBe(false);
    });

    it("should work on empty cache", () => {
      const cache = new LRUCache<string>({ maxSize: 3 });

      cache.clear();

      expect(cache.size).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle maxSize of 1", () => {
      const cache = new LRUCache<string>({ maxSize: 1 });

      cache.set("a", "1");
      expect(cache.get("a")).toBe("1");

      cache.set("b", "2");
      expect(cache.has("a")).toBe(false);
      expect(cache.get("b")).toBe("2");
    });

    it("should handle various value types", () => {
      const cache = new LRUCache<unknown>({ maxSize: 5 });

      cache.set("string", "value");
      cache.set("number", 42);
      cache.set("object", { key: "value" });
      cache.set("array", [1, 2, 3]);
      cache.set("null", null);

      expect(cache.get("string")).toBe("value");
      expect(cache.get("number")).toBe(42);
      expect(cache.get("object")).toEqual({ key: "value" });
      expect(cache.get("array")).toEqual([1, 2, 3]);
      expect(cache.get("null")).toBeNull();
    });

    it("should handle rapid set/get operations", () => {
      const cache = new LRUCache<number>({ maxSize: 100 });

      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
      }

      // Only the last 100 should remain
      expect(cache.size).toBe(100);

      for (let i = 900; i < 1000; i++) {
        expect(cache.get(`key${i}`)).toBe(i);
      }

      for (let i = 0; i < 900; i++) {
        expect(cache.has(`key${i}`)).toBe(false);
      }
    });
  });
});
