import type { DagCborEncodable } from "@orbitdb/core";

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type NestedKey = string | string[];
export type PossiblyNestedValueMap = DagCborEncodable | NestedValueMap;
export type PossiblyNestedValueObject = DagCborEncodable | NestedValueObject;
export type PossiblyNestedValue = DagCborEncodable | NestedValueMap | NestedValueObject;

export type NestedValue = NestedValueMap | NestedValueObject;
export type NestedValueMap = TypedMap<{[key: string]: PossiblyNestedValueMap}>;
export type NestedValueObject = {
  [key: string]: DagCborEncodable | NestedValueObject;
};

export type NestedMapToObject<T> = T extends NestedObjectToMap<infer R> ? R : never;

export type NestedObjectToMap<T extends NestedValueObject> = TypedMap<{
  [K in keyof T]: T[K] extends NestedValueObject
    ? NestedObjectToMap<T[K]>
    : T[K];
}>;

type StringKey<T> = Extract<keyof T, string>;

export type TypedMap<
  T extends { [key: string]: unknown } = { [key: string]: unknown },
> = Omit<Map<StringKey<T>, T[keyof T]>, "delete" | "get" | "has" | "set" | "entries" | "keys" | "values" | typeof Symbol.iterator> & {
  delete: (key: StringKey<T>) => boolean;
  get: <K extends StringKey<T>>(key: K) => T[K] | undefined;
  has: (key: StringKey<T>) => boolean;
  set: <K extends StringKey<T>>(key: K, value: T[K]) => void;
  forEach(callbackfn: <K extends StringKey<T>>(value: T[K], key: K, map: Map<keyof T, T[keyof T]>) => void): void;
  entries(): IterableIterator<[StringKey<T>, T[keyof T]]>;
  keys(): IterableIterator<StringKey<T>>;
  values(): IterableIterator<T[keyof T]>;
  [Symbol.iterator]: () => IterableIterator<[StringKey<T>, T[keyof T]]>;
};
