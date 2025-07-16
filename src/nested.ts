import { Database } from "@orbitdb/core";
import { getScalePosition } from "@orbitdb/ordered-keyvalue-db";
import type {
  Identity,
  Storage,
  AccessController,
  MetaData,
  DagCborEncodable,
  LogEntry,
  Log,
  InternalDatabase,
} from "@orbitdb/core";
import type { HeliaLibp2p } from "helia";
import itAll from "it-all";
import {
  NestedKey,
  NestedValueMap,
  NestedValueObject,
  PossiblyNestedValue,
  PossiblyNestedValueMap,
} from "./types.js";
import {
  asJoinedKey,
  flatten,
  isNestedKey,
  isNestedValue,
  isSisterKey,
  isSubkey,
  splitKey,
  toNested,
} from "./utils.js";
import type { Libp2p } from "libp2p";
import type { ServiceMap } from "@libp2p/interface";

export type NestedDatabaseType = Awaited<ReturnType<ReturnType<typeof Nested>>>;

const type = "nested" as const;

const Nested =
  () =>
  async <T extends ServiceMap = ServiceMap>({
    ipfs,
    identity,
    address,
    name,
    access,
    directory,
    meta,
    headsStorage,
    entryStorage,
    indexStorage,
    referencesCount,
    syncAutomatically,
    onUpdate,
  }: {
    ipfs: HeliaLibp2p<Libp2p<T>>;
    identity?: Identity;
    address: string;
    name?: string;
    access?: AccessController;
    directory?: string;
    meta?: MetaData;
    headsStorage?: Storage;
    entryStorage?: Storage;
    indexStorage?: Storage;
    referencesCount?: number;
    syncAutomatically?: boolean;
    onUpdate?: (log: Log, entry: LogEntry) => void;
  }) => {
    const database = await Database({
      ipfs,
      identity,
      address,
      name,
      access,
      directory,
      meta,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      syncAutomatically,
      onUpdate,
    });

    const { put, set, get, del, move, iterator, all } = NestedApi({ database });

    return {
      ...database,
      type,
      put,
      set,
      get,
      move,
      del,
      iterator,
      all,
    };
  };

Nested.type = type;

export const NestedApi = ({ database }: { database: InternalDatabase }) => {
  const putEntry = async (
    key: NestedKey,
    value: DagCborEncodable,
    position?: number,
  ): Promise<string> => {
    const entries = (await itAll(iterator())).filter((entry) =>
      isSisterKey(entry.key, key),
    );
    key = asJoinedKey(key);

    // Avoid overwriting existing position; default to end of list
    let scaledPosition: number | undefined = undefined;
    if (position === undefined) {
      scaledPosition = entries.find((e) => e.key === key)?.position;
    }
    if (scaledPosition === undefined) {
      scaledPosition = await getScalePosition({
        entries,
        key,
        position: position ?? -1,
      });
    }

    return database.addOperation({
      op: "PUT",
      key,
      value: { value, position: scaledPosition },
    });
  };

  const move = async (key: NestedKey, position: number): Promise<string> => {
    const entries = (await itAll(iterator())).filter((entry) =>
      isSisterKey(entry.key, key),
    );
    position = await getScalePosition({
      entries,
      key: asJoinedKey(key),
      position,
    });

    return database.addOperation({ op: "MOVE", key, value: position });
  };

  const del = async (key: NestedKey): Promise<string> => {
    return database.addOperation({
      op: "DEL",
      key: asJoinedKey(key),
      value: null,
    });
  };

  const get = async (
    key: NestedKey,
  ): Promise<PossiblyNestedValueMap | undefined> => {
    const joinedKey = asJoinedKey(key);
    const relevantKeyValues: { key: string; value: DagCborEncodable }[] = [];

    for await (const entry of iterator()) {
      const { key: k, value } = entry;
      if (k === joinedKey || isSubkey(k, joinedKey))
        relevantKeyValues.push({ key: k, value });
    }
    let nested: PossiblyNestedValueMap | undefined =
      toNested(relevantKeyValues);
    for (const k of splitKey(joinedKey)) {
      try {
        nested = (nested as NestedValueMap).get(k);
      } catch {
        return undefined;
      }
    }
    return nested;
  };

  type PutFunction = {
    (object: NestedValueObject): Promise<string[]>;
    (
      key: NestedKey,
      object: PossiblyNestedValue,
      position?: number,
    ): Promise<string[]>;
  };
  const put: PutFunction = async (
    keyOrObject,
    object?: PossiblyNestedValue,
    position?: number,
  ): Promise<string[]> => {
    let flattenedEntries: {
      key: string;
      value: DagCborEncodable;
      position?: number;
    }[];

    if (isNestedKey(keyOrObject)) {
      // If a key was given
      // Join key
      keyOrObject = asJoinedKey(keyOrObject);

      // Ensure value exists
      if (object === undefined) throw new Error("Must specify a value to add");

      // Flatten entries if a nested value was given
      if (isNestedValue(object)) {
        flattenedEntries = flatten(object).map((entry) => ({
          key: `${keyOrObject}/${entry.key}`,
          value: entry.value,
        }));
      } else {
        flattenedEntries = [{ key: keyOrObject, value: object, position }];
      }
    } else {
      // If no key was given
      flattenedEntries = flatten(keyOrObject);
    }
    return await Promise.all(
      flattenedEntries.map((e) => putEntry(e.key, e.value, e.position)),
    );
  };

  const iterator = async function* ({
    amount,
  }: { amount?: number } = {}): AsyncGenerator<
    {
      key: string;
      value: DagCborEncodable;
      hash: string;
      position: number;
    },
    void,
    unknown
  > {
    // `true` indicates a `PUT` operation; `number` indicates a `MOVE` operation
    const keys: { [key: string]: true | number } = {};
    let count = 0;

    const keyExists = (key: string) => {
      // Only detect `PUT` operations
      return (
        keys[key] === true ||
        Object.keys(keys).find((k) => keys[k] === true && isSubkey(key, k))
      );
    };

    for await (const entry of database.log.traverse()) {
      const { op, key, value } = entry.payload;
      if (typeof key !== "string") continue;

      if (op === "PUT" && !keyExists(key)) {
        if (value === undefined) continue;

        const hash = entry.hash;
        const putValue = value as { value: DagCborEncodable; position: number };
        const position =
          typeof keys[key] === "number"
            ? (keys[key] as number)
            : putValue.position;

        keys[key] = true;
        count++;

        yield {
          key,
          value: putValue.value,
          hash,
          position,
        };
      } else if (op === "MOVE") {
        // Here we check for the presence of previous `MOVE` operations on the precise key
        // or of `PUT` operations on a root key
        if (typeof keys[key] === "number" || keyExists(key)) continue;

        keys[key] = value as number;
      } else if (op === "DEL" && !keyExists(key)) {
        keys[key] = true;
      }
      if (amount !== undefined && count >= amount) {
        break;
      }
    }
  };

  const all = async (): Promise<NestedValueMap> => {
    const values = [];
    for await (const entry of iterator()) {
      values.unshift(entry);
    }
    const sorted = values.toSorted((a, b) => a.position - b.position);

    return toNested(sorted);
  };

  return {
    put,
    set: put,
    del,
    get,
    move,
    iterator,
    all,
  };
};

export default Nested;
