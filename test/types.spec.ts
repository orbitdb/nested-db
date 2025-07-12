import { expect } from "aegir/chai";
import { NestedMapToObject, NestedObjectToMap, TypedMap } from "@/types.js";

describe("Types", () => {
  describe("Typed map", () => {
    describe("simple structure", () => {
      it("get value", ()=> {
        type Structure = { a: number, b: number };
        const map: TypedMap<Structure> = new Map<"a" | "b", number>([["a", 1]])
        
        let valA: number | undefined = undefined;
        valA = map.get("a")
        expect(valA).to.equal(1)
        
        // @ts-expect-error Wrong key
        map.get("c")
      })
      it("set value", ()=> {
        type Structure = { a: number, b: number };
        const map: TypedMap<Structure> = new Map<"a" | "b", number>([["a", 1]])

        map.set("b", 1)
        
        // @ts-expect-error Wrong key
        map.set("c", 3)

        // @ts-expect-error Wrong value type
        map.set("b", "text")
      });

      it("two types", () => {
        type Structure = { a: number, b: string };
        const map = new Map<"a" | "b", number | string>([["a", 1]]) as TypedMap<Structure>;
        let valA: number | undefined = undefined;
        valA = map.get("a")
        expect(valA).to.equal(1)
      })

      it("any key", () => {
        type Structure = { [key: string]: number };
        const map: TypedMap<Structure> = new Map<string, number>([["a", 1]])
        let valA: number | undefined = undefined;
        valA = map.get("a")
        expect(valA).to.equal(1)
      })
    })
  })

  describe("Nested object to map", () => {
    it("simple structure", () => {
        type Structure = { a: number, b: string };
        const map = new Map<"a" | "b", number | string>([["a", 1], ["b", "text"]]) as NestedObjectToMap<Structure>
        expect(map.keys()).to.deep.equal(["a", "b"])
      })
    it("nested structure", () => {
      type Structure = { a: number, b: { c: string, d: boolean } };
      const map = new Map<"a" | "b", number | Map<"c" | "d", string | boolean>>([["a", 1], ["b", new Map<"c" | "d", string | boolean>([["c", "text"], ["d", true]])]]) as  NestedObjectToMap<Structure>
      expect(map.keys()).to.deep.equal(["a", "b"])
    })
    it("error on wrong key", () => {
      type Structure = { a: number, b: string };
      const map: NestedObjectToMap<Structure> = new Map();
      
      // @ts-expect-error Wrong key
      map.set("c", 1)
    })
    it("error on wrong value", () => {
      type Structure = { a: number, b: string };
      const map: NestedObjectToMap<Structure> = new Map();
      
      // @ts-expect-error Wrong type
      map.set("a", "c")
    })
    it("error on wrong nested key", () => {
      type Structure = { a: number, b:  { c: string, d: boolean } };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong key
      map.get("b")?.set("e", "text");
    })
    it("error on wrong nested value", () => {
      type Structure = { a: number, b:  { c: string, d: boolean } };
      const map: NestedObjectToMap<Structure> = new Map();
      
      // @ts-expect-error Wrong type
      map.get("b")?.set("c", 3);
    })
    it("error on interchanged key values", () => {
      type Structure = { a: number, b: string };
      const map: NestedObjectToMap<Structure> = new Map();
      
      // @ts-expect-error Wrong type
      map.set("a", "text")
    })
    it("error on interchanged nested key values", () => {
      type Structure = { a: number, b:  { c: string, d: boolean } };
      const map: NestedObjectToMap<Structure> = new Map();
      
      // @ts-expect-error Wrong type
      map.get("b")?.set("c", true);
    });
    it("any key", () => {
      type Structure = { [key: string]: number };
      const map: NestedObjectToMap<Structure> = new Map()
      map.set("a", 1)
    })
    it("nested value any key", () => {
      type Structure = { a: { [key: string]: number } };
      const map: NestedObjectToMap<Structure> = new Map()
      
      map.set("a", new Map())
      const aValue = map.get("a")
      aValue?.set("b", 1)
      
      const bValue = aValue?.get("b")
      expect(bValue).to.equal(1)
    })
    it("error any key wrong type", () => {
      type Structure = { [key: string]: number };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.set("a", "text")
    })
    it("error nested value any key wrong type", () => {
      type Structure = { a: { [key: string]: number } };
      const map: NestedObjectToMap<Structure> = new Map();

      // @ts-expect-error Wrong type
      map.get("a")?.set("b", "text");
    })
  })
  describe("Nested map to object", () => {
    it("simple structure", () => {
      type Structure = { a: number, b: string };
      const nestedObj: NestedMapToObject<TypedMap<Structure>> = { a: 1, b: "text"}
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
    it("nested structure", () => {
      type Structure = { a: number, b: { c: string, d: boolean } };
      const nestedObj: NestedMapToObject<TypedMap<Structure>> = { a: 1, b: { c: "text", d: false } };
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
    it("error on wrong key", () => {
      type Structure = { a: number, b: string };
      // @ts-expect-error
      const nestedObj:  NestedMapToObject<TypedMap<Structure>> = { c: 1, b: "text" }
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
    it("error on wrong value", () => {
      type Structure = { a: number, b: string };
      // @ts-expect-error
      const nestedObj: NestedMapToObject<TypedMap<Structure>> = { a: "c", b: "text" };
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
    it("error on wrong nested key", () => {
      type Structure = { a: number, b:  { c: string, d: boolean } };
      // @ts-expect-error
      const nestedObj: NestedMapToObject<TypedMap<Structure>> = {};  // todo
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
    it("error on wrong nested value", () => {
      type Structure = { a: number, b:  { c: string, d: boolean } };
      // @ts-expect-error
      const nestedObj: NestedMapToObject<TypedMap<Structure>> = {};  // todo
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
    it("error on interchanged key values", () => {
      type Structure = { a: number, b: string };
      // @ts-expect-error
      const nestedObj: NestedMapToObject<TypedMap<Structure>> = {};  // todo
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
    it("error on interchanged nested key values", () => {
      type Structure = { a: number, b:  { c: string, d: boolean } };
      // @ts-expect-error
      const nestedObj: NestedMapToObject<TypedMap<Structure>> = {};  // todo
      expect(nestedObj.keys).to.deep.equal(["a", "b"])
    })
  })
})