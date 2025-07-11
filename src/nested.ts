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
  NestedValue,
  NestedValueMap,
  PossiblyNestedValue,
} from "./types";
import {
  asJoinedKey,
  flatten,
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

    const { put, set, putNested, setNested, get, del, move, iterator, all } =
      NestedApi({ database });

    return {
      ...database,
      type,
      put,
      set,
      putNested,
      setNested,
      get,
      move,
      del,
      iterator,
      all,
    };
  };

Nested.type = type;

export const NestedApi = ({ database }: { database: InternalDatabase }) => {
  const put = async (
    key: NestedKey,
    value: DagCborEncodable,
    position = -1,
  ): Promise<string> => {
    const entries = (await itAll(iterator())).filter((entry) =>
      isSisterKey(entry.key, key),
    );
    position = await getScalePosition({
      entries,
      key: asJoinedKey(key),
      position,
    });

    return database.addOperation({
      op: "PUT",
      key: asJoinedKey(key),
      value: { value, position },
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
  ): Promise<PossiblyNestedValue | undefined> => {
    const joinedKey = asJoinedKey(key);
    const relevantKeyValues: { key: string; value: DagCborEncodable }[] = [];

    for await (const entry of iterator()) {
      const { key: k, value } = entry;
      if (k === joinedKey || isSubkey(k, joinedKey))
        relevantKeyValues.push({ key: k, value });
    }
    let nested: PossiblyNestedValue | undefined = toNested(relevantKeyValues);
    for (const k of splitKey(joinedKey)) {
      try {
        nested = (nested as NestedValueMap).get(k);
      } catch {
        return undefined;
      }
    }
    return nested;
  };

  type PutNestedFunction = {
    (object: NestedValue): Promise<string[]>;
    (key: string, object: NestedValue): Promise<string[]>;
  };
  const putNested: PutNestedFunction = async (
    keyOrObject,
    object?: NestedValue | undefined,
  ): Promise<string[]> => {
    let flattenedEntries: { key: string; value: DagCborEncodable }[];
    if (typeof keyOrObject === "string") {
      flattenedEntries = flatten(object!).map((entry) => ({
        key: `${keyOrObject}/${entry.key}`,
        value: entry.value,
      }));
    } else {
      flattenedEntries = flatten(keyOrObject);
    }
    return await Promise.all(flattenedEntries.map((e) => put(e.key, e.value)));
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
        keys[key] = true;
        count++;
        const hash = entry.hash;
        const putValue = value as { value: DagCborEncodable; position: number };

        yield {
          key,
          value: putValue.value,
          hash,
          position:
            typeof keys[key] === "number"
              ? (keys[key] as number)
              : putValue.position,
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
    return toNested(values);
  };

  return {
    put,
    set: put,
    del,
    get,
    putNested,
    setNested: putNested,
    move,
    iterator,
    all,
  };
};

export default Nested;
