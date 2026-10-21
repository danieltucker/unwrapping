import { redirect } from "next/navigation";

import { santaMine, secretSanta } from "@/lib/routes";
import { participantByToken } from "@/lib/secret-santa";
import { setSantaToken } from "@/lib/session";

/**
 * A participant's private link: /secret-santa/p/<token>.
 *
 * Remembers the token in a cookie for that exchange and moves on to the
 * participant's page, so the secret leaves the address bar — and the history,
 * and anything screen-shared — after one hop. A route handler, because cookies
 * can't be set while a page renders.
 *
 * A link that was replaced, or whose person left, goes to /secret-santa with a
 * sentence saying so, rather than to a bare 404 that reads like a typo.
 */
export async function GET(_request: Request, context: RouteContext<"/secret-santa/p/[token]">) {
  const { token } = await context.params;

  const found = await participantByToken(token);
  if (!found) redirect(`${secretSanta}?link=expired`);

  await setSantaToken(found.code, token);
  redirect(santaMine(found.code));
}
