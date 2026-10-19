/**
 * The storage backend the Sighting Log writes to: the subset of the Web Storage
 * API it needs, so `localStorage` can be passed straight in.
 */
export interface LogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage, for tests (and as a fallback when the browser blocks localStorage). */
export function memoryStorage(): LogStorage & { dump(): Record<string, string> } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, String(value));
    },
    removeItem: (key) => {
      items.delete(key);
    },
    dump: () => Object.fromEntries(items),
  };
}
