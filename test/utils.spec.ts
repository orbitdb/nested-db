

import { expect } from "aegir/chai";
import { flatten, isSubkey, joinKey, splitKey, toNested } from "@/utils.js";

describe("Utils", () => {
  describe("to nested", () => {
    it("nest values", () => {
      const actual = toNested([
        { key: "a/b", value: 1 },
        { key: "a/c", value: 2 },
        { key: "d", value: 3 },
      ]);
      expect(actual).to.deep.equal({ a: { b: 1, c: 2 }, d: 3 });
    });
  });

  describe("flatten", () => {
    it("flatten nested", () => {
      const actual = flatten({ a: { b: 1, c: 2 }, d: 3 });
      expect(actual).to.deep.equal([
        { key: "a/b", value: 1 },
        { key: "a/c", value: 2 },
        { key: "d", value: 3 },
      ]);
    });
  });

  describe("split key", () => {
    it("nested key", () => {
      const actual = splitKey("a/b/c");
      expect(actual).to.deep.equal(["a", "b", "c"]);
    });
    it("single key", () => {
      const actual = splitKey("a");
      expect(actual).to.deep.equal(["a"]);
    });
  });

  describe("join key", () => {
    it("nested key", () => {
      const actual = joinKey(["a", "b", "c"]);
      expect(actual).to.deep.equal("a/b/c");
    });
    it("single key", () => {
      const actual = joinKey(["a"]);
      expect(actual).to.deep.equal("a");
    });
  });

  describe("Is subkey", () => {
    it("subkey and key", () => {
      const actual = isSubkey("a/b/c", "a/b");
      expect(actual).to.be.true();
    });
    it("key and subkey", () => {
      const actual = isSubkey("a/b", "a/b/c");
      expect(actual).to.be.false();
    });
    it("root key", () => {
      const actual = isSubkey("a/b/c", "a");
      expect(actual).to.be.true();
    });
    it("different paths", () => {
      const actual = isSubkey("a/b", "c/d");
      expect(actual).to.be.false();
    });
    it("diverging paths", () => {
      const actual = isSubkey("a/b/c", "a/b/d");
      expect(actual).to.be.false();
    });
    it("same key", () => {
      const actual = isSubkey("a/b/c", "a/b/c");
      expect(actual).to.be.false();
    });
  });
});