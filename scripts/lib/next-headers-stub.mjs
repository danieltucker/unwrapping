/**
 * Stands in for `next/headers` in tests run under plain Node. The jar is the
 * request's cookies: a test sets it to whoever it is pretending to be. The
 * request headers work the same way, for tests that need a user agent or a
 * Do Not Track header; empty unless a test fills them.
 */
export const jar = (globalThis.__testCookies ??= new Map());
export const requestHeaders = (globalThis.__testHeaders ??= new Map());

export async function cookies() {
  return {
    get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name, value) => jar.set(name, value),
    delete: (name) => jar.delete(name),
  };
}

export async function headers() {
  return new Headers([...requestHeaders]);
}
