import Link from "next/link";

import * as routes from "@/lib/routes";

/**
 * The top of the editor, for the moments an owner needs telling something:
 * they have just landed from the homepage's first-gift form or from copying
 * someone else's list, and their list is still an unsaved draft. Either, both,
 * or neither; neither draws nothing.
 *
 * The first-gift welcome only lasts while the pasted gift is the only one.
 * After that the owner has found the add button, and "your first gift is on the
 * list" would be stale the moment the second one arrives. A copy arrives with
 * many gifts at once, so its welcome has no such limit.
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
   * answered, "name" when the gift was typed in rather than linked. "copy" is
   * set by copyToList, for a list made from someone else's.
   */
  started: "link" | "partial" | "name" | "copy" | null;
  isDraft: boolean;
  giftCount: number;
}) {
  const copied = started === "copy";
  const welcome = !copied && started !== null && giftCount <= 1;
  if (!copied && !welcome && !isDraft) return null;

  return (
    <aside className="mb-5 rounded-card border border-violet-edge bg-violet-wash p-5">
      {copied ? (
        <>
          <p className="mb-1 text-base font-semibold">Your copy is ready</p>
          <p className="mb-4 max-w-[44rem] text-sm leading-relaxed text-ink-76">
            These gifts are yours now. Edit, reorder or take off anything, add
            your own with <strong className="font-semibold">+ Add gift</strong>,
            and set a date with the pencil next to the title. Nothing you change
            here touches the list you copied.
          </p>
        </>
      ) : null}

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
          {welcome || copied ? null : (
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
