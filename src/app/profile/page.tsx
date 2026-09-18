import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { db } from "@/db";
import { users } from "@/db/schema";
import { toDateInput } from "@/lib/date";
import * as routes from "@/lib/routes";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your profile",
  // Somebody's account. Nothing here belongs in a search result.
  robots: { index: false, follow: false },
};

/**
 * The owner's own details, as opposed to a list's.
 *
 * Read fresh from the row rather than from the session: the session carries
 * only what every page needs, and this is the one screen that edits the rest.
 */
export default async function ProfilePage() {
  const viewer = await getCurrentUser();
  // Guests have no profile, because they have no account. Sending them to sign
  // in is the honest version of a 404 here: there is a page, it just needs one.
  if (!viewer) redirect(routes.signIn);

  const user = await db.select().from(users).where(eq(users.id, viewer.id)).get();
  // The account went away underneath the session — deleted in another tab, or
  // a database restored from before it existed.
  if (!user) redirect(routes.signIn);

  return (
    <main className="mx-auto w-full max-w-[38rem] px-[1.375rem] py-10 sm:px-8">
      <h1 className="mb-2 font-display text-[1.875rem] leading-[1.1] tracking-[-0.03em]">
        Your profile
      </h1>
      <p className="mb-6 text-sm leading-relaxed text-ink-76">
        What we know about you, which is deliberately not much. None of it is
        shown to the guests who open one of your lists.
      </p>

      <ProfileForm
        name={user.name}
        email={user.email}
        handle={user.handle}
        avatarUrl={user.avatarUrl}
        birthday={toDateInput(user.birthday)}
      />
    </main>
  );
}
