import type { NestedDatabaseType } from "@/nested";

export const fillKeys = async (
  db: NestedDatabaseType,
  n: number,
): Promise<string[]> => {
  const keyValues = [...Array(n).keys()].map((i) => ({
    key: `key${i}`,
    value: `value${i}`,
  }));
  const hashes: string[] = [];
  for (const { key, value } of keyValues) {
    hashes.push(...(await db.put(key, value)));
  }
  return hashes;
};
