import { DagCborEncodable } from "@orbitdb/core";

import type {
  NestedKey,
  NestedMapToObject,
  NestedObjectToMap,
  NestedValueMap,
  NestedValueObject,
  PossiblyNestedValueMap,
  PossiblyNestedValue,
  NestedValue,
} from "./types.ts";
import { getScalePosition } from "@orbitdb/ordered-keyvalue-db";

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
): x is NestedValueObject => {
  return (
    typeof x === "object" &&
    !Array.isArray(x) &&
    x !== null &&
    !(x instanceof Map)
  );
};

export const isNestedValueMap = (
  x: PossiblyNestedValue,
): x is NestedValueMap => {
  return x instanceof Map;
};

export const isNestedValue = (x: PossiblyNestedValue): x is NestedValue => {
  return isNestedValueObject(x) || isNestedValueMap(x);
};

export const isNestedKey = (x: unknown): x is NestedKey => {
  return (
    typeof x === "string" ||
    (Array.isArray(x) && x.every((k) => typeof k === "string"))
  );
};

export const flatten = (
  x: NestedValueMap | NestedValueObject,
): { key: string; value: DagCborEncodable }[] => {
  const flattened: { key: string; value: DagCborEncodable }[] = [];
  const xAsMap = isNestedValueMap(x) ? x : toMap(x);

  const recursiveFlatten = (
    x: PossiblyNestedValueMap,
    rootKey: string[],
  ): void => {
    if (isNestedValueMap(x)) {
      for (const [key, value] of x.entries()) {
        recursiveFlatten(value, [...rootKey, key]);
      }
    } else {
      flattened.push({ key: rootKey.join("/"), value: x });
    }
  };

  recursiveFlatten(xAsMap as NestedValueMap, []);
  return flattened;
};

export const toNested = (
  x: { key: string; value?: DagCborEncodable }[],
): NestedValueMap => {
  const nested = new Map<string, unknown>() as NestedValueMap;

  for (const { key, value } of x) {
    const keyComponents = splitKey(key);
    let root = nested;
    for (const c of keyComponents.slice(0, -1)) {
      const existing = root.get(c);
      if (existing === undefined || !isNestedValueMap(existing)) {
        root.set(c, new Map() as NestedValueMap);
      }
      root = root.get(c) as NestedValueMap;
    }
    const finalKeyComponent = keyComponents.pop();
    if (finalKeyComponent) {
      if (value === undefined) {
        if (root.get(finalKeyComponent) === undefined)
          root.set(finalKeyComponent, new Map());
      } else {
        const finalValue = isNestedValueObject(value) ? toMap(value) : value;
        root.set(finalKeyComponent, finalValue as PossiblyNestedValueMap);
      }
    }
  }
  return nested;
};

export const toMap = <T extends NestedValueObject>(
  x: T,
): NestedObjectToMap<T> => {
  const map = new Map();
  for (const [key, value] of Object.entries(x)) {
    if (isNestedValueObject(value)) {
      map.set(key, toMap(value));
    } else {
      map.set(key, value);
    }
  }
  return map as unknown as NestedObjectToMap<T>;
};

export const toObject = <T extends NestedValueMap>(
  x: T,
): NestedMapToObject<T> => {
  const dict = {} as NestedMapToObject<T>;
  for (const [key, value] of x.entries()) {
    if (value instanceof Map) {
      // @ts-expect-error TODO
      dict[key] = toObject(value);
    } else {
      // @ts-expect-error TODO
      dict[key as keyof T] = value;
    }
  }
  return dict;
};

export const positionToScale = (entries: {
  key: string;
  value: DagCborEncodable;
  hash: string;
  position: number;
}[], key: string, position?: number) => {
  const sisterEntries = entries.filter((entry) =>
    isSisterKey(entry.key, key),
  );
  // Avoid overwriting existing position; default to end of list
  let scaledPosition: number | undefined = undefined;
  if (position === undefined) {
    scaledPosition = sisterEntries.find((e) => e.key === key)?.position;
  }
  if (scaledPosition === undefined) {
    scaledPosition = getScalePosition({
      entries: sisterEntries,
      key,
      position: position ?? -1,
    });
  }
  return scaledPosition
}