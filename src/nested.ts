import { Database } from "@orbitdb/core";
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
import type {
  NestedKey,
  NestedValue,
  NestedValueWithUndefined,
  PossiblyNestedValue,
} from "./types";
import {
  flatten,
  isNestedValue,
  isSubkey,
  joinKey,
  removeUndefineds,
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

    const { put, set, insert, get, del, iterator, all } = NestedApi({
      database,
    });

    return {
      ...database,
      type,
      put,
      set,
      insert,
      get,
      del,
      iterator,
      all,
    };
  };

Nested.type = type;

export const NestedApi = ({ database }: { database: InternalDatabase }) => {
  const { addOperation, log } = database;

  const put = async (
    key: NestedKey,
    value: DagCborEncodable,
  ): Promise<string> => {
    const joinedKey = typeof key === "string" ? key : joinKey(key);
    return await addOperation({ op: "PUT", key: joinedKey, value });
  };

  const del = async (key: NestedKey): Promise<string> => {
    const joinedKey = typeof key === "string" ? key : joinKey(key);
    return await addOperation({ op: "DEL", key: joinedKey, value: null });
  };

  const get = async (
    key: NestedKey,
  ): Promise<PossiblyNestedValue | undefined> => {
    const joinedKey = typeof key === "string" ? key : joinKey(key);
    const relevantKeyValues: { key: string; value: DagCborEncodable }[] = [];

    for await (const entry of iterator()) {
      const { key: k, value } = entry;
      if (k === joinedKey || isSubkey(k, joinedKey))
        relevantKeyValues.push({ key: k, value });
    }
    let nested: PossiblyNestedValue = toNested(relevantKeyValues);
    for (const k of splitKey(joinedKey)) {
      try {
        nested = (nested as NestedValue)[k];
      } catch {
        return undefined;
      }
    }
    return nested;
  };

  type InsertFunction = {
    (object: NestedValueWithUndefined): Promise<string>;
    (key: string, object: NestedValueWithUndefined): Promise<string>;
  };

  const insert: InsertFunction = async (
    keyOrObject,
    object?: NestedValueWithUndefined | undefined,
  ): Promise<string> => {
    if (typeof keyOrObject === "string") {
      const joinedRootKey =
        typeof keyOrObject === "string" ? keyOrObject : joinKey(keyOrObject);
      return await addOperation({
        op: "INSERT",
        key: joinedRootKey,
        value: removeUndefineds(object!),
      });
    } else {
      console.log({ keyOrObject, val: removeUndefineds(keyOrObject) });
      return await addOperation({
        op: "INSERT",
        key: null,
        value: removeUndefineds(keyOrObject),
      });
    }
  };

  const iterator = async function* ({
    amount,
  }: { amount?: number } = {}): AsyncGenerator<
    {
      key: string;
      value: DagCborEncodable;
      hash: string;
    },
    void,
    unknown
  > {
    const keys: { [key: string]: true } = {};
    let count = 0;

    const keyExists = (key: string) => {
      return !!keys[key] || Object.keys(keys).find((k) => isSubkey(key, k));
    };

    function* processEntry({
      key,
      value,
      hash,
    }: {
      key: string;
      value: DagCborEncodable | undefined;
      hash: string;
    }) {
      if (keyExists(key)) return;
      if (value === undefined) return;
      keys[key] = true;
      count++;
      yield { key, value, hash };
    }

    for await (const entry of log.traverse()) {
      const { op, key, value } = entry.payload;

      if (op === "INSERT") {
        if (typeof value !== "object" || !isNestedValue(value)) continue;
        const flattenedEntries = flatten(value).map((entry) => ({
          key: key === null ? entry.key : `${key}/${entry.key}`,
          value: entry.value,
        }));
        const hash = entry.hash;
        for (const flat of flattenedEntries) {
          yield* processEntry({ key: flat.key, value: flat.value, hash });
        }
      }

      if (typeof key !== "string") continue;

      if (op === "PUT") {
        const hash = entry.hash;
        yield* processEntry({ key, value, hash });
      } else if (op === "DEL") {
        keys[key] = true;
      }
      if (amount !== undefined && count >= amount) {
        break;
      }
    }
  };

  const all = async (): Promise<NestedValue> => {
    const values = [];
    for await (const entry of iterator()) {
      values.unshift(entry);
    }
    return toNested(values);
  };

  return {
    put,
    set: put,
    del,
    get,
    insert,
    iterator,
    all,
  };
};

export default Nested;
