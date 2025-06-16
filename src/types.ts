import type { DagCborEncodable } from "@orbitdb/core";

export type NestedKey = string | string[];
export type PossiblyNestedValue =
  | DagCborEncodable
  | { [key: string]: PossiblyNestedValue };
export type NestedValue = { [key: string]: DagCborEncodable | NestedValue };
