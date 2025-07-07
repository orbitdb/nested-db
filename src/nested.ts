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
import { NestedKey, NestedValue, PossiblyNestedValue } from "./types";
import { flatten, isSubkey, joinKey, splitKey, toNested } from "./utils.js";
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

    const {
      put,
      set,
      putNested,
      setNested,
      get,
      del,
      iterator,
      all,
    } = NestedApi({ database });

    return {
      ...database,
      type,
      put,
      set,
      putNested,
      setNested,
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
    return addOperation({ op: "PUT", key: joinedKey, value });
  };

  const del = async (key: NestedKey): Promise<string> => {
    const joinedKey = typeof key === "string" ? key : joinKey(key);
    return addOperation({ op: "DEL", key: joinedKey, value: null });
  };

  const get = async (key: NestedKey): Promise<PossiblyNestedValue> => {
    const joinedKey = typeof key === "string" ? key : joinKey(key);
    const relevantKeyValues: { key: string; value: DagCborEncodable }[] = [];

    for await (const entry of iterator()) {
      const { key: k, value } = entry;
      if (k === joinedKey || isSubkey(k, joinedKey))
        relevantKeyValues.push({ key: k, value });
    }
    let nested: PossiblyNestedValue = toNested(relevantKeyValues);
    for (const k of splitKey(joinedKey)) {
      nested = (nested as NestedValue)[k];
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
      flattenedEntries = flatten(object).map((entry) => ({
        key: `${keyOrObject}/${entry.key}`,
        value: entry.value,
      }));
    } else {
      flattenedEntries = flatten(keyOrObject);
    }
    return await Promise.all(
      flattenedEntries.map((e) => put(e.key, e.value)),
    );
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
    for await (const entry of log.traverse()) {
      const { op, key, value } = entry.payload;
      if (op === "PUT" && !keyExists(key)) {
        keys[key] = true;
        count++;
        const hash = entry.hash;
        yield { key, value, hash };
      } else if (op === "DEL" && !keyExists(key)) {
        keys[key] = true;
      }
      if (count >= amount) {
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
    putNested,
    setNested: putNested,
    iterator,
    all,
  }
}

export default Nested;
