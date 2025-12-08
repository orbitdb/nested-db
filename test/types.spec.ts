import { expect } from "aegir/chai";
import type {
  NestedMapToObject,
  NestedObjectToMap,
  RecursivePartial,
  TypedMap,
} from "@/types.js";

describe("Types", () => {
  describe("Typed map", () => {
    describe("simple structure", () => {
      it("get value", () => {
        type Structure = { a: number; b: number };
        const map: TypedMap<Structure> = new Map<"a" | "b", number>([["a", 1]]);

        let valA: number | undefined = undefined;
        valA = map.get("a");
        expect(valA).to.equal(1);

        // @ts-expect-error Wrong key
        map.get("c");
      });
      it("set value", () => {
        type Structure = { a: number; b: number };
        const map: TypedMap<Structure> = new Map<"a" | "b", number>([["a", 1]]);

        map.set("b", 1);

        // @ts-expect-error Wrong key
        map.set("c", 3);

        // @ts-expect-error Wrong value type
        map.set("b", "text");
      });

      it("two types", () => {
        type Structure = { a: number; b: string };
        const map: TypedMap<Structure> = new Map();

        map.set("a", 1);
        let valA: number | undefined = undefined;
        valA = map.get("a");
        expect(valA).to.equal(1);

        // @ts-expect-error Wrong type
        valA = map.get("b");
      });

      it("any key", () => {
        type Structure = { [key: string]: number };
        const map: TypedMap<Structure> = new Map<string, number>([["a", 1]]);
        let valA: number | undefined = undefined;
        valA = map.get("a");
        expect(valA).to.equal(1);
      });
    });
  });

  describe("Nested object to map", () => {
    it("simple structure", () => {
      type Structure = { a: number; b: string };
      const map = new Map<"a" | "b", number | string>([
        ["a", 1],
        ["b", "text"],
      ]) as NestedObjectToMap<Structure>;

      const a = map.get("a");
      expect(a).to.equal(1);
    });
    it("nested structure", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };

      const map = new Map<"a" | "b", number | Map<"c" | "d", string | boolean>>(
        [
          ["a", 1],
          [
            "b",
            new Map<"c" | "d", string | boolean>([
              ["c", "text"],
              ["d", true],
            ]),
          ],
        ],
      ) as NestedObjectToMap<Structure>;
      const c = map.get("b")?.get("c");
      expect(c).to.equal("text");
    });
    it("error on wrong key", () => {
      type Structure = { a: number; b: string };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong key
      map.set("c", 1);
    });
    it("error on wrong value", () => {
      type Structure = { a: number; b: string };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.set("a", "c");
    });
    it("error on wrong nested key", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong key
      map.get("b")?.set("e", "text");
    });
    it("error on wrong nested value", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.get("b")?.set("c", 3);
    });
    it("error on interchanged key values", () => {
      type Structure = { a: number; b: string };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.set("a", "text");
    });
    it("error on interchanged nested key values", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.get("b")?.set("c", true);
    });
    it("any key", () => {
      type Structure = { [key: string]: number };
      const map: NestedObjectToMap<Structure> = new Map();
      map.set("a", 1);
    });
    it("nested value any key", () => {
      type Structure = { a: { [key: string]: number } };
      const map: NestedObjectToMap<Structure> = new Map();

      map.set("a", new Map());
      const aValue = map.get("a");
      aValue?.set("b", 1);

      const bValue = aValue?.get("b");
      expect(bValue).to.equal(1);
    });
    it("error any key wrong type", () => {
      type Structure = { [key: string]: number };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.set("a", "text");
    });
    it("error nested value any key wrong type", () => {
      type Structure = { a: { [key: string]: number } };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.get("a")?.set("b", "text");
    });
  });
  describe("Nested map to object", () => {
    it("simple structure", () => {
      type Structure = { a: number; b: string };
      const nestedObj: NestedMapToObject<NestedObjectToMap<Structure>> = {
        a: 1,
        b: "text",
      };
      nestedObj.a = 3;
    });
    it("nested structure", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };
      const nestedObj: NestedMapToObject<NestedObjectToMap<Structure>> = {
        a: 1,
        b: { c: "text", d: false },
      };

      nestedObj.b.c = "test";
    });
    it("error on wrong key", () => {
      type Structure = { a: number; b: string };
      const nestedObj: NestedMapToObject<
        NestedObjectToMap<RecursivePartial<Structure>>
      > = {};
      // @ts-expect-error Wrong key
      nestedObj.c = 1;
    });
    it("error on wrong value", () => {
      type Structure = { a: number; b: string };
      const nestedObj: NestedMapToObject<
        NestedObjectToMap<RecursivePartial<Structure>>
      > = {};
      // @ts-expect-error Wrong value
      nestedObj.a = "c";
    });
    it("error on wrong nested key", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };
      const nestedObj: NestedMapToObject<
        NestedObjectToMap<RecursivePartial<Structure>>
      > = {};

      const bValue = nestedObj["b"];

      // @ts-expect-error Wrong key
      if (bValue) bValue.e = 3;
    });
    it("error on wrong nested value", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };
      const nestedObj: NestedMapToObject<
        NestedObjectToMap<RecursivePartial<Structure>>
      > = {};

      const bValue = nestedObj["b"];

      // @ts-expect-error Wrong type
      if (bValue) bValue.d = 1;
    });
    it("error on interchanged key values", () => {
      type Structure = { a: number; b: string };
      const nestedObj: NestedMapToObject<
        NestedObjectToMap<RecursivePartial<Structure>>
      > = {};

      // @ts-expect-error Interchanged value type
      nestedObj.a = "text";
    });
    it("error on interchanged nested key values", () => {
      type Structure = { a: number; b: { c: string; d: boolean } };
      const nestedObj: NestedMapToObject<
        NestedObjectToMap<RecursivePartial<Structure>>
      > = {};

      const bValue = nestedObj["b"];
      // @ts-expect-error Interchanged value type
      if (bValue) bValue.c = false;
    });
  });
});
