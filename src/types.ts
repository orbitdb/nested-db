import type { DagCborEncodable } from "@orbitdb/core";

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type NestedKey = string | string[];

export type PossiblyNestedValue<T = DagCborEncodable> = T | NestedValue<T>;
export type NestedValue<T = DagCborEncodable> = {
  [key: string]: T | NestedValue<T>;
};
export type NestedValueWithUndefined = NestedValue<
  DagCborEncodable | undefined
>;
export type PossiblyNestedValueWithUndefined = PossiblyNestedValue<
  DagCborEncodable | undefined
>;
