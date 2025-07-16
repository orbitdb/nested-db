# @orbitdb/nested-db
Nested key-value database type for OrbitDB.

[![orbit-db-nested tests](https://github.com/orbitdb/nested-db/actions/workflows/run-test.yml/badge.svg?branch=main)](https://github.com/orbitdb/nested-db/actions/workflows/run-test.yml)
[![codecov](https://codecov.io/gh/orbitdb/nested-db/graph/badge.svg?token=7OZK4BJDej)](https://codecov.io/gh/orbitdb/nested-db)

## Installation
```
$ pnpm add @orbitdb/nested-db
```
## Introduction
As `Nested` database is like a [`KeyValue`](https://github.com/orbitdb/orbitdb/blob/main/src/databases/keyvalue.js) database, but it can contain nested values that can be accessed as JSON.

## Examples

A simple example with `Nested`:
```ts
import { createOrbitDB, useDatabaseType } from "@orbitdb/core";
import { Nested } from "@orbitdb/nested-db";

// Register nested database type. IMPORTANT - must call before creating orbit instance !
useDatabaseType(Nested);

const orbitdb = await createOrbitDB({ ipfs })

const db = await orbitdb.open({ type: "nested" });

await db.put("a", 1);
await db.put("b/c", 2);
await db.put(["b", "d"], 3)  // Alternative syntax

const all = await db.all();  // { a: 1, b: { c: 2, d: 3 } }

await db.get("b")  // { c: 2, d: 3 }

await db.del("b");
await db.all();  // { "a": 1 }
```

A more complex example with object types:
```ts
import { createOrbitDB, useDatabaseType } from "@orbitdb/core";
import { Nested } from "@orbitdb/nested-db";

// Register nested database type. IMPORTANT - must call before creating orbit instance !
useDatabaseType(Nested);

const orbit = await createOrbitDB({ ipfs })

const db = await orbitdb.open({ type: "nested" });

await db.put({ a: { b: 1, c: 2 } });
await db.put({ d: 3 });

const all = await db.all();  // { a: { b: 1, c: 2}, d: 3 }

```
 