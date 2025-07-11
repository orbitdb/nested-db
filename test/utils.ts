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
    expect(ref.keys()).to.deep.equal(map.keys());
    for (const key of ref.keys()) {
      if (ref.get(key) instanceof Map) {
        const mapBranch = map.get(key);
        expect(mapBranch).to.be.instanceOf(Map);
        expectNestedMapEqual(
          mapBranch as unknown as NestedValueMap,
          ref.get(key),
        );
      }
    }
  }
};
