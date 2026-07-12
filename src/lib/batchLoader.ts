import 'server-only';

export function createBatchLoader<TKey, TRow>(
  loadMany: (keys: TKey[]) => Promise<TRow[]>,
  keyOf: (row: TRow) => TKey,
) {
  let pending: TKey[] = [];
  let batch: Promise<Map<TKey, TRow>> | null = null;

  return async (key: TKey): Promise<TRow | undefined> => {
    pending.push(key);
    const current = batch ?? (batch = Promise.resolve().then(async () => {
      const keys = pending;
      pending = [];
      batch = null;
      const rows = await loadMany(keys);
      return new Map(rows.map((row) => [keyOf(row), row]));
    }));
    const map = await current;
    return map.get(key);
  };
}
