import { adminOrNull } from "@/lib/admin";
import { latestEvents } from "@/lib/tracking-stats";

/**
 * The live feed in /admin's Tracking section: the newest 50 events, ids only.
 * Polled every few seconds by TrackingFeed.
 *
 * Anyone but an administrator gets the same 404 the admin page gives them.
 */
export async function GET() {
  if (!(await adminOrNull())) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  return Response.json(
    { events: await latestEvents(), now: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
