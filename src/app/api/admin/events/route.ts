import { adminOrNull } from "@/lib/admin";
import { parseTrackingFilter } from "@/lib/tracking-filter";
import { latestEvents } from "@/lib/tracking-stats";

/**
 * The live feed on /admin/analytics: the newest events, ids only, narrowed by
 * the same query string as the page. Polled every few seconds by TrackingFeed.
 *
 * Anyone but an administrator gets the same 404 the admin page gives them.
 */
export async function GET(request: Request) {
  if (!(await adminOrNull())) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const filter = parseTrackingFilter(new URL(request.url).searchParams);
  return Response.json(
    { events: await latestEvents(filter), now: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
