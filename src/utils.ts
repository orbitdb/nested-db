import { DagCborEncodable } from "@orbitdb/core";

import {
  NestedKey,
  NestedMapToObject,
  NestedObjectToMap,
  NestedValue,
  NestedValueMap,
  NestedValueObject,
  PossiblyNestedValue,
} from "./types";

export const splitKey = (key: string): string[] => key.split("/");
export const joinKey = (key: string[]): string => key.join("/");

export const asSplitKey = (key: NestedKey): string[] =>
  typeof key === "string" ? splitKey(key) : key;
export const asJoinedKey = (key: NestedKey): string =>
  typeof key === "string" ? key : joinKey(key);

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

const isNestedValue = (x: PossiblyNestedValue): x is NestedValue => {
  return typeof x === "object" && !Array.isArray(x) && x !== null;
};

export const flatten = (
  x: NestedValue,
): { key: string; value: DagCborEncodable }[] => {
  const flattened: { key: string; value: DagCborEncodable }[] = [];

  const recursiveFlatten = (
    x: PossiblyNestedValue,
    rootKey: string[],
  ): void => {
    if (isNestedValue(x)) {
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
): NestedValueMap => {
  const nested = new Map() as NestedValueMap;

  for (const { key, value } of x) {
    const keyComponents = splitKey(key);
    let root = nested;
    for (const c of keyComponents.slice(0, -1)) {
      const existing = root.get(c);
      if (existing === undefined || !isNestedValue(existing)) {
        // @ts-expect-error Unclear why
        root.set(c, new Map() as NestedValueMap);
      }
      root = root.get(c) as unknown as NestedValueMap;
    }
    const finalKeyComponent = keyComponents.pop();
    if (finalKeyComponent) {
      const finalValue = isNestedValue(value) ? toMap(value) : value;
      root.set(
        finalKeyComponent,
        // @ts-expect-error Unclear why
        finalValue,
      );
    }
  }
  return nested;
};

export const toMap = <T extends NestedValueObject>(
  x: T,
): NestedObjectToMap<T> => {
  const map: NestedObjectToMap<T> = new Map();
  for (const [key, value] of Object.entries(x)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // @ts-expect-error Unclear why
      map.set(key, toMap(value));
    } else {
      // @ts-expect-error Unclear why
      map.set(key as keyof T, value);
    }
  }
  return map;
};

export const toObject = <T extends NestedValueMap>(
  x: T,
): NestedMapToObject<T> => {
  const dict = {} as NestedMapToObject<T>;
  for (const [key, value] of x) {
    if (value instanceof Map) {
      // @ts-expect-error Unclear why
      dict[key] = toObject(value);
    } else {
      // @ts-expect-error Unclear why
      dict[key] = value;
    }
  }
  return dict;
};
