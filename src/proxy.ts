import { NextResponse } from "next/server";

import { santaEnabled } from "@/lib/santa-flag";

/**
 * Secret Santa's off switch, at the door. With SECRET_SANTA=off every page,
 * private link, preview image and form post under /secret-santa answers 404,
 * as though the feature had never shipped. The actions check the switch
 * themselves as well, because an action can be posted to any path.
 */
export function proxy() {
  if (santaEnabled()) return NextResponse.next();
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = {
  matcher: ["/secret-santa", "/secret-santa/:path*"],
};
