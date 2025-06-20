import { DagCborEncodable, useDatabaseType } from "@orbitdb/core";

import Nested from "@/nested.js";
import { NestedValue, PossiblyNestedValue } from "./types";

export const splitKey = (key: string): string[] => key.split("/");
export const joinKey = (key: string[]): string => key.join("/");

export const isSubkey = (subkey: string, key: string): boolean => {
  const subkeyComponents = splitKey(subkey);
  const keyComponents = splitKey(key);

  // Either not a subkey, either identical keys
  if (subkeyComponents.length === keyComponents.length) return false;

  for (const c of keyComponents) {
    if (subkeyComponents[0] === c) {
      subkeyComponents.shift();
    } else {
      return false;
    }
  }
  return true;
};

export const flatten = (
  x: NestedValue,
): { key: string; value: DagCborEncodable }[] => {
  const flattened: { key: string; value: DagCborEncodable }[] = [];

  const recursiveFlatten = (
    x: PossiblyNestedValue,
    rootKey: string[],
  ): void => {
    if (typeof x === "object" && !Array.isArray(x)) {
      for (const [key, value] of Object.entries(x)) {
        recursiveFlatten(value, [...rootKey, key]);
      }
    } else {
      flattened.push({ key: rootKey.join("/"), value: x });
    }
  };

  recursiveFlatten(x, []);
  return flattened;
};

export const toNested = (
  x: { key: string; value: DagCborEncodable }[],
): NestedValue => {
  const nested: NestedValue = {};
  for (const { key, value } of x) {
    const keyComponents = splitKey(key);
    let root = nested;
    for (const c of keyComponents.slice(0, -1)) {
      if (typeof root[c] !== "object" || Array.isArray(root[c])) root[c] = {};
      root = root[c] as NestedValue;
    }
    root[keyComponents.pop()] = value;
  }
  return nested;
};
