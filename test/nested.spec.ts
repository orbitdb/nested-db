import { type HeliaLibp2p } from "helia";

import Nested, { NestedDatabaseType } from "@/nested.js";
import { createTestHelia } from "./config.js";

import {
  DagCborEncodable,
  Identities,
  Identity,
  KeyStore,
  KeyStoreType,
} from "@orbitdb/core";
import { expect } from "aegir/chai";
import { isBrowser } from "wherearewe";
import { flatten, isSubkey, joinKey, splitKey, toNested } from "@/utils.js";

const keysPath = "./testkeys";

describe("Nested Database", () => {
  let ipfs: HeliaLibp2p;
  let identities;
  let keystore: KeyStoreType;
  let testIdentity1: Identity;
  let db: NestedDatabaseType;

  const databaseId = "nested-AAA";

  before(async () => {
    ipfs = await createTestHelia();

    keystore = await KeyStore({ path: keysPath });
    identities = await Identities({ keystore });
    testIdentity1 = await identities.createIdentity({ id: "userA" });
  });

  after(async () => {
    if (ipfs) {
      await ipfs.stop();
    }

    if (keystore) {
      await keystore.close();
    }
    if (!isBrowser) {
      const { rimraf } = await import("rimraf");
      await rimraf(keysPath);
      await rimraf("./orbitdb");
      await rimraf("./ipfsS");
    }
  });

  describe("Creating a Nested database", () => {
    beforeEach(async () => {
      db = await Nested()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
    });

    afterEach(async () => {
      if (db) {
        await db.drop();
        await db.close();
      }
    });

    it("creates a nested store", async () => {
      expect(db.address.toString()).to.equal(databaseId);
      expect(db.type).to.equal("nested");
    });

    it("returns 0 items when it's a fresh database", async () => {
      const all = [];
      for await (const item of db.iterator()) {
        all.unshift(item);
      }

      expect(all.length).to.equal(0);
    });
  });

  describe("Nested database API", () => {
    beforeEach(async () => {
      db = await Nested()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
    });

    afterEach(async () => {
      if (db) {
        await db.drop();
        await db.close();
      }
    });

    it("add a key-value pair", async () => {
      const key = "key1";
      const expected = "value1";

      const hash = await db.put(key, expected);
      expect(hash).to.be.a.not.empty("string");

      const actual = await db.get(key);
      expect(actual).to.equal(expected);
    });

    it("remove a key-value pair", async () => {
      const key = "key1";

      await db.put(key, "value1");
      await db.del(key);

      const actual = await db.get(key);
      expect(actual).to.be.undefined();
    });

    it("get key's updated value when using put", async () => {
      const key = "key1";
      const expected = "hello2";

      await db.put(key, "value1");
      await db.put(key, expected);
      const actual = await db.get(key);
      expect(actual).to.equal(expected);
    });

    it("get key's updated value when using set", async () => {
      const key = "key1";
      const expected = "hello2";

      await db.set(key, "value1");
      await db.set(key, expected);
      const actual = await db.get(key);
      expect(actual).to.equal(expected);
    });

    it("remove a nonexisting key", async () => {
      const key = "key1";
      const value = "value1";

      await db.put(key, value);
      await db.del("key2");

      const actual = await db.get(key);

      expect(actual).to.equal(value);
    });

    it("remove and then add a key-value pair", async () => {
      const key = "key1";
      const value = "value1";

      await db.del(key);
      await db.set(key, value);

      const actual = await db.get(key);

      expect(actual).to.equal(value);
    });

    it("add a nested value", async () => {
      await db.put("a/b", 1);
      await db.put("a/c", 2);

      const actual = await db.all();
      expect(actual).to.deep.equal({ a: { b: 1, c: 2 }});
    });

    it("get a nested value", async () => {
      await db.put("a/b", 1);
      await db.put("a/c", 2);

      const actual = await db.get("a");
      expect(actual).to.deep.equal({ b: 1, c: 2 });

      const actualAB = await db.get("a/b");
      expect(actualAB).to.equal(1);
    });

    it("remove a nested value", async () => {
      await db.put(["a/b"], 1);
      await db.put("a/c", 2);

      await db.del("a/b");
      await db.del(["a", "c"]);

      const actual = await db.all();
      expect(actual).to.be.empty();
    });

    it("add a nested value - list syntax", async () => {
      await db.put(["a", "b"], 1);
      await db.put(["a", "c"], 2);

      const actual = await db.all();
      expect(actual).to.deep.equal({ a: { b: 1, c: 2 }});
    });

    it("remove root key", async () => {
      await db.put("a/b", 1);
      await db.put("a/c", 2);

      await db.del("a");

      const actual = await db.all();
      expect(actual).to.be.empty();
    });

    it("overwrite root key", async () => {
      await db.put("a/b", 1);
      await db.put("a/c", 2);

      await db.put("a", 3);

      const actual = await db.all();
      expect(actual).to.deep.equal({ a: 3 });
    });

    it("put nested", async () => {
      await db.putNested({ a: { b: 1, c: 2 } });

      const actual = await db.all();
      expect(actual).to.deep.equal({ a: { b: 1, c: 2 }});
    });

    it("put key nested value", async () => {
      await db.put("a", { b: 2, c: 3 });
      await db.put("a", { b: 1 });

      const actual = await db.all();
      expect(actual).to.deep.equal({ a: { b: 1 } });
    });

    it("put nested value merges with previous values", async () => {
      await db.put("a", { b: 2, c: 3 });
      await db.putNested("a", { b: 1 });

      const actual = await db.all();
      expect(actual).to.deep.equal({ a: { b: 1, c: 3 } });
    });

    it("returns all values", async () => {
      const keyvalue: {
        key: string;
        value: DagCborEncodable;
        hash?: string;
      }[] = [
        {
          key: "key1",
          value: "init",
        },
        {
          key: "key2",
          value: true,
        },
        {
          key: "key3",
          value: "hello",
        },
        {
          key: "key4",
          value: "friend",
        },
        {
          key: "key5",
          value: "12345",
        },
        {
          key: "key6",
          value: "empty",
        },
        {
          key: "key7",
          value: "friend33",
        },
      ];

      for (const entry of Object.values(keyvalue)) {
        entry.hash = await db.put(entry.key, entry.value);
      }

      const all: { key: string; value: DagCborEncodable; hash?: string }[] = [];
      for await (const pair of db.iterator()) {
        all.unshift(pair);
      }

      expect(all).to.deep.equal(keyvalue);
    });
  });

  describe("Iterator", () => {
    before(async () => {
      db = await Nested()({
        ipfs,
        identity: testIdentity1,
        address: databaseId,
      });
    });

    after(async () => {
      if (db) {
        await db.drop();
        await db.close();
      }
    });

    it("has an iterator function", async () => {
      expect(db.iterator).to.not.be.undefined();
      expect(typeof db.iterator).to.equal("function");
    });

    it("returns no values when the database is empty", async () => {
      const all = [];
      for await (const { hash, value } of db.iterator()) {
        all.unshift({ hash, value });
      }
      expect(all.length).to.equal(0);
    });

    it("returns all values when the database is not empty", async () => {
      await db.put("key1", 1);
      await db.put("key2", 2);
      await db.put("key3", 3);
      await db.put("key4", 4);
      await db.put("key5", 5);

      // Add one more value and then delete it to count
      // for the fact that the amount returned should be
      // the amount of actual values returned and not
      // the oplog length, and deleted values don't
      // count towards the returned amount.
      await db.put("key6", 6);
      await db.del("key6");

      const all = [];
      for await (const { hash, value } of db.iterator()) {
        all.unshift({ hash, value });
      }
      expect(all.length).to.equal(5);
    });

    it("returns only the amount of values given as a parameter", async () => {
      const amount = 3;
      const all = [];
      for await (const { hash, value } of db.iterator({ amount })) {
        all.unshift({ hash, value });
      }
      expect(all.length).to.equal(amount);
    });

    it("returns only two values if amount given as a parameter is 2", async () => {
      const amount = 2;
      const all = [];
      for await (const { hash, value } of db.iterator({ amount })) {
        all.unshift({ hash, value });
      }
      expect(all.length).to.equal(amount);
    });

    it("returns only one value if amount given as a parameter is 1", async () => {
      const amount = 1;
      const all = [];
      for await (const { hash, value } of db.iterator({ amount })) {
        all.unshift({ hash, value });
      }
      expect(all.length).to.equal(amount);
    });
  });

  describe("Utils", () => {
    describe("to nested", () => {
      it("nest values", () => {
        const actual = toNested([
          { key: "a/b", value: 1 },
          { key: "a/c", value: 2 },
          { key: "d", value: 3 },
        ]);
        expect(actual).to.deep.equal({ a: { b: 1, c: 2 }, d: 3 });
      });
    });

    describe("flatten", () => {
      it("flatten nested", () => {
        const actual = flatten({ a: { b: 1, c: 2 }, d: 3 });
        expect(actual).to.deep.equal([
          { key: "a/b", value: 1 },
          { key: "a/c", value: 2 },
          { key: "d", value: 3 },
        ]);
      });
    });

    describe("split key", () => {
      it("nested key", () => {
        const actual = splitKey("a/b/c");
        expect(actual).to.deep.equal(["a", "b", "c"]);
      });
      it("single key", () => {
        const actual = splitKey("a");
        expect(actual).to.deep.equal(["a"]);
      });
    });

    describe("join key", () => {
      it("nested key", () => {
        const actual = joinKey(["a", "b", "c"]);
        expect(actual).to.deep.equal("a/b/c");
      });
      it("single key", () => {
        const actual = joinKey(["a"]);
        expect(actual).to.deep.equal("a");
      });
    });

    describe("Is subkey", () => {
      it("subkey and key", () => {
        const actual = isSubkey("a/b/c", "a/b");
        expect(actual).to.be.true();
      });
      it("key and subkey", () => {
        const actual = isSubkey("a/b", "a/b/c");
        expect(actual).to.be.false();
      });
      it("root key", () => {
        const actual = isSubkey("a/b/c", "a");
        expect(actual).to.be.true();
      });
      it("different paths", () => {
        const actual = isSubkey("a/b", "c/d");
        expect(actual).to.be.false();
      });
      it("diverging paths", () => {
        const actual = isSubkey("a/b/c", "a/b/d");
        expect(actual).to.be.false();
      });
      it("same key", () => {
        const actual = isSubkey("a/b/c", "a/b/c");
        expect(actual).to.be.false();
      });
    });
  });
});
