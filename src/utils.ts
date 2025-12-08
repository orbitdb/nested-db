import { DagCborEncodable } from "@orbitdb/core";

import { NestedKey, NestedValue, PossiblyNestedValue } from "./types";

export const splitKey = (key: string): string[] => key.split("/");
export const joinKey = (key: string[]): string => key.join("/");

export const asSplitKey = (key: NestedKey): string[] =>
  typeof key === "string" ? splitKey(key) : key;

export const asJoinedKey = (key: NestedKey): string =>
  typeof key === "string" ? key : joinKey(key);

export const parentKey = (key: NestedKey): string | undefined => {
  const keyComponents = asSplitKey(key);
  if (keyComponents.length > 1) return asJoinedKey(keyComponents.slice(0, -1));
  return undefined;
};

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

export const isSisterKey = (key1: NestedKey, key2: NestedKey): boolean => {
  const key1Components = asSplitKey(key1);
  const key2Components = asSplitKey(key2);

  // Return false if different length
  if (key1Components.length !== key2Components.length) return false;
  if (key1Components.length === 0) return true;

  for (const [i, k1] of key1Components.slice(0, -1).entries()) {
    if (k1 !== key2Components[i]) return false;
  }
  return true;
};

export const isNestedValueObject = (
  x: PossiblyNestedValue,
): x is NestedValue => {
  return (
    typeof x === "object" &&
    !Array.isArray(x) &&
    x !== null &&
    !(x instanceof Map)
  );
};

export const isNestedKey = (x: unknown): x is NestedKey => {
  return (
    typeof x === "string" ||
    (Array.isArray(x) && x.every((k) => typeof k === "string"))
  );
};

export const flatten = (
  x: NestedValue,
): { key: string; value: DagCborEncodable }[] => {
  const flattened: { key: string; value: DagCborEncodable }[] = [];

  const recursiveFlatten = (
    x: PossiblyNestedValue,
    rootKey: string[],
  ): void => {
    if (typeof x === "object" && !Array.isArray(x) && x !== null) {
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
    const finalKeyComponent = keyComponents.pop()
    if (finalKeyComponent) root[finalKeyComponent] = value;
  }
  return nested;
};