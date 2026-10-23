import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import * as routes from "@/lib/routes";

/**
 * /admin is its tabs; this is the door to the first. Checked first so a
 * stranger gets the 404, not a redirect that gives the screen away.
 */
export default async function AdminPage() {
  await requireAdmin();
  redirect(routes.adminAnalytics);
}
