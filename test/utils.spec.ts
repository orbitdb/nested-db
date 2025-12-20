import { expect } from "aegir/chai";
import {
  flatten,
  isSisterKey,
  isSubkey,
  joinKey,
  removeUndefineds,
  splitKey,
  toNested,
} from "@/utils.js";

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

    it("overlapping object values", () => {
      const actual = toNested([
        { key: "a/c", value: 2 },
        { key: "a", value: { b: 1 } },
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

  describe("is subkey", () => {
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

  describe("is sister key", () => {
    it("sister keys", () => {
      const actual = isSisterKey("a/b/c", "a/b/d");
      expect(actual).to.be.true();
    });
    it("root keys", () => {
      const actual = isSisterKey("a", "b");
      expect(actual).to.be.true();
    });
    it("same key - nested", () => {
      const actual = isSisterKey("a/b/c", "a/b/c");
      expect(actual).to.be.true();
    });
    it("same key - root", () => {
      const actual = isSisterKey("a", "a");
      expect(actual).to.be.true();
    });
    it("empty keys", () => {
      const actual = isSisterKey("", "");
      expect(actual).to.be.true();
    });
    it("one key is empty", () => {
      const actual = isSisterKey("a", "");
      expect(actual).to.be.true();
    });
    it("one key is empty - inversed", () => {
      const actual = isSisterKey("", "b");
      expect(actual).to.be.true();
    });
    it("subkey and key", () => {
      const actual = isSisterKey("a/b/c", "a/b");
      expect(actual).to.be.false();
    });
    it("key and subkey", () => {
      const actual = isSisterKey("a/b", "a/b/c");
      expect(actual).to.be.false();
    });
    it("one is root key", () => {
      const actual = isSisterKey("a/b/c", "a");
      expect(actual).to.be.false();
    });
    it("different paths", () => {
      const actual = isSisterKey("a/b", "c/d");
      expect(actual).to.be.false();
    });
    it("same path but deeper", () => {
      const actual = isSisterKey("a/b/c", "a/b/d/e");
      expect(actual).to.be.false();
    });
    it("same path but deeper - inversed", () => {
      const actual = isSisterKey("a/b/c/e", "a/b/d");
      expect(actual).to.be.false();
    });
  });

  describe("remove undefineds", () => {
    it("remove root undefined", () => {
      const actual = removeUndefineds({ a: 1, b: undefined, c: { d: 2 } });

      expect(Object.keys(actual)).to.not.include("b");
      expect(actual).to.deep.equal({ a: 1, c: { d: 2 } });
    });

    it("remove nested undefined", () => {
      const actual = removeUndefineds({
        a: 1,
        b: 2,
        c: { d: undefined, e: 3 },
      });

      expect(Object.keys(actual.c!)).to.not.include("d");
      expect(actual).to.deep.equal({ a: 1, b: 2, c: { e: 3 } });
    });
  });
});
