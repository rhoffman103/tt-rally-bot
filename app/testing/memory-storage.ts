// An in-memory localStorage for tests. Node has no localStorage unless it runs with --experimental-webstorage.
import { vi } from 'vitest';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

/** Gives each test an empty localStorage. Call in `beforeEach`; undo with `vi.unstubAllGlobals()`. */
export function stubLocalStorage(): Storage {
  const storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  return storage;
}
