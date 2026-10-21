/**
 * Stands in for `next/cache` in tests run under plain Node. There is no cache
 * to revalidate; the paths are kept in case a test wants to look.
 */
export const revalidated = (globalThis.__testRevalidated ??= []);

export function revalidatePath(path) {
  revalidated.push(path);
}

/** Re-renders the current page in Next. Nothing to re-render here. */
export function refresh() {}
