import Link from "next/link";

import * as routes from "@/lib/routes";

/**
 * The top of the editor, for the two moments an owner needs telling something:
 * they have just landed from the homepage's first-gift form, and their list
 * is still an unsaved draft. Either, both, or neither; neither draws nothing.
 *
 * The welcome only lasts while the pasted gift is the only one. After that the
 * owner has found the add button, and "your first gift is on the list" would be
 * stale the moment the second one arrives.
 *
 * The save half is the reminder deferred sign-up promises: a draft is held by a
 * cookie in one browser (see ensureDraftToken), and saying so plainly is the
 * honest reason to make an account. It gets more pointed as there is more to
 * lose, because a list with five gifts on it is worth thirty seconds of form.
 */
export function DraftBanner({
  started,
  isDraft,
  giftCount,
}: {
  /**
   * From ?started=, set by startFromGift. "partial" when the shop half
   * answered, "name" when the gift was typed in rather than linked.
   */
  started: "link" | "partial" | "name" | null;
  isDraft: boolean;
  giftCount: number;
}) {
  const welcome = started !== null && giftCount <= 1;
  if (!welcome && !isDraft) return null;

  return (
    <aside className="mb-5 rounded-card border border-violet-edge bg-violet-wash p-5">
      {welcome ? (
        <>
          <p className="mb-1 text-base font-semibold">
            Your first gift is on the list
          </p>
          <p className="mb-4 max-w-[44rem] text-sm leading-relaxed text-ink-76">
            Paste a few more with <strong className="font-semibold">+ Add gift</strong>,
            then give the list a proper name and a date with the pencil next to its
            title.
            {started === "partial"
              ? " That shop didn’t tell us everything, so check the title, photo and price on the gift below."
              : started === "name"
                ? " Edit the gift below to add a link, a photo or a price, so guests know exactly which one you mean."
                : null}
          </p>
        </>
      ) : null}

      {isDraft ? (
        <>
          {welcome ? null : (
            <p className="mb-1 text-base font-semibold">
              {giftCount >= 3
                ? `You’ve added ${giftCount} gifts. Don’t lose them.`
                : "Save your list so you don’t lose it"}
            </p>
          )}
          <p className="mb-4 max-w-[44rem] text-sm leading-relaxed text-ink-76">
            Right now this list lives only in this browser. A free account keeps
            it safe, gives it a link with your name in it, and lets you edit it
            from your phone after you&rsquo;ve shared it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={routes.signUp}
              className="rounded-pill bg-violet px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
            >
              Save my list
            </Link>
            <Link
              href={routes.signIn}
              className="text-sm font-semibold text-ink-72 underline-offset-2 hover:underline"
            >
              I already have an account
            </Link>
          </div>
        </>
      ) : null}
    </aside>
  );
}
