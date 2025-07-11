import type { DagCborEncodable } from "@orbitdb/core";

export type NestedKey = string | string[];
export type PossiblyNestedValue = DagCborEncodable | NestedValue;

export type NestedValue = NestedValueMap | NestedValueObject;
export type NestedValueMap<T extends NestedValueObject = NestedValueObject> =
  NestedObjectToMap<T>;
export type NestedValueObject = {
  [key: string]: DagCborEncodable | NestedValueObject;
};
export type NestedMapToObject<T extends NestedValueMap> = {
  [K in keyof T]: T[K] extends NestedValueMap ? NestedMapToObject<T[K]> : T[K];
};
export type NestedObjectToMap<T extends NestedValueObject> = TypedMap<{
  [K in keyof T]: T[K] extends NestedValueObject
    ? NestedObjectToMap<T[K]>
    : T[K];
}>;

export type TypedMap<
  T extends { [key: string]: unknown } = { [key: string]: unknown },
> = Omit<Map<keyof T, T[keyof T]>, "delete" | "get" | "has" | "set"> & {
  delete: (key: keyof T) => boolean;
  get: <K extends keyof T>(key: K) => T[K] | undefined;
  has: (key: keyof T) => boolean;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
};
