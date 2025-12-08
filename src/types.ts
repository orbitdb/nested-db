import type { DagCborEncodable } from "@orbitdb/core";

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type NestedKey = string | string[];

export type PossiblyNestedValue = DagCborEncodable | NestedValue;
export type NestedValue = {
  [key: string]: DagCborEncodable | NestedValue;
};
