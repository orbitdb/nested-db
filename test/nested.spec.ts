import { type HeliaLibp2p } from "helia";

import Nested, { NestedDatabaseType } from "@/nested.js";
import { createTestHelia } from "./config.js";

import { Identities, Identity, KeyStore, KeyStoreType } from "@orbitdb/core";
import { expect } from "aegir/chai";
import { isBrowser } from "wherearewe";
import { NestedValueMap } from "@/types.js";
import { expectNestedMapEqual, fillKeys } from "./utils.js";
import { toObject } from "@/utils.js";

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
      await rimraf("./ipfs");
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
      expectNestedMapEqual(actual, { a: { b: 1, c: 2 } });
    });

    it("get a nested value", async () => {
      await db.put("a/b", 1);
      await db.put("a/c", 2);

      const actual = await db.get("a");
      expectNestedMapEqual(actual as NestedValueMap, { b: 1, c: 2 });

      const actualAB = await db.get("a/b");
      expect(actualAB).to.equal(1);
    });

    it("get an inexisting nested key", async () => {
      const actual = await db.get("b/d");
      expect(actual).to.be.undefined();
    });

    it("remove a nested value", async () => {
      await db.put(["a/b"], 1);
      await db.put("a/c", 2);

      await db.del("a/b");
      await db.del(["a", "c"]);

      const actual = await db.all();
      expectNestedMapEqual(actual, new Map([["a", new Map()]]));
    });

    it("add a nested value - list syntax", async () => {
      await db.put(["a", "b"], 1);
      await db.put(["a", "c"], 2);

      const actual = await db.all();
      expectNestedMapEqual(actual, { a: { b: 1, c: 2 } });
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
      expectNestedMapEqual(actual, { a: 3 });
    });

    it("put nested without key", async () => {
      await db.put({ a: { b: 1, c: 2 } });

      const actual = await db.all();
      expectNestedMapEqual(actual, { a: { b: 1, c: 2 } });
    });

    it("put nested value merges with previous values", async () => {
      await db.put("a", { b: 2, c: 3 });
      await db.put("a", { b: 1 });

      const actual = await db.all();

      expectNestedMapEqual(actual, { a: { b: 1, c: 3 } });
    });

    it("add positioned nested value after put", async () => {
      await db.put("a", { b: 2, c: 3 });
      await db.put("a/d", 1, 1);

      const actual = await db.all();

      // Check unordered structure
      expect(toObject(actual)).to.deep.equal({ a: { b: 2, c: 3, d: 1 } });

      // Here we only check the middle value, because we don't know if key0 or key1 was
      // added first due to the race condition we intentionally introduced above.
      const actualA = actual.get("a") as Map<string, number>;
      expect([...(actualA?.keys() || [])][1]).to.equal("d");
    });

    it("move a value", async () => {
      await fillKeys(db, 3);
      await db.move("key0", 1);

      const actual = await db.all();

      const ref = new Map();
      ref.set("key1", "value1");
      ref.set("key0", "value0");
      ref.set("key2", "value2");

      expectNestedMapEqual(actual, ref);
    });

    it("get a moved value", async () => {
      await db.put("a/key0", "value0");
      await db.put("a/key1", "value1");
      await db.put("a/key2", "value2");
      await db.move("a/key0", 1);

      const actual = await db.get("a");

      const ref = new Map();
      ref.set("key1", "value1");
      ref.set("key0", "value0");
      ref.set("key2", "value2");

      expect(actual).to.exist();
      expectNestedMapEqual(actual as NestedValueMap, ref);
    });

    it("move a value to index 0", async () => {
      await fillKeys(db, 3);
      await db.move("key2", 0);

      const actual = await db.all();

      const ref = new Map();
      ref.set("key2", "value2");
      ref.set("key0", "value0");
      ref.set("key1", "value1");

      expectNestedMapEqual(actual, ref);
    });

    it("move a value to negative index", async () => {
      await fillKeys(db, 3);
      await db.move("key0", -1);

      const actual = await db.all();

      const ref = new Map();
      ref.set("key1", "value1");
      ref.set("key2", "value2");
      ref.set("key0", "value0");

      expectNestedMapEqual(actual, ref);
    });

    it("move multiple values to negative index", async () => {
      await fillKeys(db, 3);
      await db.move("key0", -1);
      await db.move("key1", -1);

      const actual = await db.all();

      const ref = new Map();
      ref.set("key2", "value2");
      ref.set("key0", "value0");
      ref.set("key1", "value1");

      expectNestedMapEqual(actual, ref);
    });

    it("move a value to index > length", async () => {
      await fillKeys(db, 3);
      await db.move("key1", 5);
      await db.put("key3", "value3");

      const actual = await db.all();

      const ref = new Map();
      ref.set("key0", "value0");
      ref.set("key2", "value2");
      ref.set("key1", "value1");
      ref.set("key3", "value3");

      expectNestedMapEqual(actual, ref);
    });

    it("add a value twice, with new position", async () => {
      await fillKeys(db, 3);
      await db.put("key2", "value2", 1);

      const actual = await db.all();

      const ref = new Map();
      ref.set("key0", "value0");
      ref.set("key2", "value2");
      ref.set("key1", "value1");

      expectNestedMapEqual(actual, ref);
    });

    it("move and override a key concurrently", async () => {
      await fillKeys(db, 3);
      await db.move("key2", 0);
      await db.put("key2", "value2a");

      const actual = await db.all();

      const ref = new Map();
      ref.set("key2", "value2a");
      ref.set("key0", "value0");
      ref.set("key1", "value1");

      expectNestedMapEqual(actual, ref);
    });

    it("move a value twice", async () => {
      await fillKeys(db, 3);
      await db.move("key2", 0);
      await db.move("key2", 1);

      const actual = await db.all();

      const ref = new Map();
      ref.set("key0", "value0");
      ref.set("key2", "value2");
      ref.set("key1", "value1");

      expectNestedMapEqual(actual, ref);
    });

    it("move nested value", async () => {
      await db.put("a/b", 1);
      await db.put("a/c", 2);

      const refBefore = new Map();
      refBefore.set("a", new Map());
      refBefore.get("a").set("b", 1);
      refBefore.get("a").set("c", 2);

      const actual = await db.all();
      expectNestedMapEqual(actual, refBefore);

      await db.move("a/b", 1);

      const actualAfterMove = await db.all();
      const refAfter = new Map();
      refAfter.set("a", new Map());
      refAfter.get("a").set("c", 2);
      refAfter.get("a").set("b", 1);
      expectNestedMapEqual(actualAfterMove, refAfter);
    });

    it("synchronous addition", async () => {
      await Promise.all(
        [...Array(2).keys()].map((i) => db.put(`key${i}`, `value${i}`)),
      );
      await db.put("in", "between", 1);

      const actual = await db.all();

      // Here we only check the middle value, because we don't know if key0 or key1 was
      // added first due to the race condition we intentionally introduced above.
      expect([...actual.keys()][1]).to.equal("in");
      expect(actual.get("in")).to.equal("between");
    });

    it("move root of nested value", async () => {
      await db.put("a/b", 1);
      await db.put("a/c/d", 2);
      await db.put("a/c/e", 3);

      await db.move("a/c", 0);

      const actual = await db.all();

      const ref = new Map();
      ref.set("a", new Map());
      ref.get("a").set("c", new Map());
      ref.get("a").set("b", 1);
      ref.get("a").get("c").set("d", 2);
      ref.get("a").get("c").set("e", 3);

      expectNestedMapEqual(actual, ref);
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
});
