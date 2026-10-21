/**
 * Stands in for `next/server` in tests run under plain Node. connection() is
 * how a page tells Next not to prerender it; outside Next there is nothing to
 * prerender, so it resolves straight away.
 */
export async function connection() {}
