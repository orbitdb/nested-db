import { NestedDatabaseType } from "@/nested";
import { NestedValueMap, NestedValueObject } from "@/types";
import { toObject } from "@/utils.js";
import { expect } from "aegir/chai";

export const expectNestedMapEqual = (
  map: NestedValueMap,
  ref: NestedValueMap | NestedValueObject,
) => {
  // Check type
  expect(map instanceof Map).to.be.true();

  // Check structure
  const refAsObject = ref instanceof Map ? toObject(ref) : ref;
  expect(toObject(map)).to.deep.equal(refAsObject);

  // If `ref` is also a Map, check order of keys
  if (ref instanceof Map) {
    expect([...map.keys()]).to.deep.equal([...ref.keys()]);
    for (const key of ref.keys()) {
      const value = ref.get(key)
      if (value instanceof Map) {
        const mapBranch = map.get(key);
        expect(mapBranch).to.be.instanceOf(Map);
        expectNestedMapEqual(mapBranch as NestedValueMap, value);
      }
    }
  }
};

export const fillKeys = async (db: NestedDatabaseType, n: number): Promise<string[]> => {
  const keyValues = (
    [...Array(n).keys()].map((i) => ({key: `key${i}`, value: `value${i}`}))
  )
  const hashes: string[] = [];
  for (const {key, value} of keyValues) {
    hashes.push(...await db.put(key, value));
  }
  return hashes;
}