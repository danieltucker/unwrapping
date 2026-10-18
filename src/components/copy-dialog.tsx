"use client";

import Link from "next/link";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { copyToList, type CopyState } from "@/app/lists/[handle]/[slug]/actions";
import { Modal } from "@/components/modal";
import { Button, CapsLabel, Input } from "@/components/ui";
import type { CopyDestination } from "@/lib/copying";

/**
 * "Copy this list" and "Add to my list", which are the same dialog asked about
 * different amounts.
 *
 * One dialog for the whole page rather than one per card: a list can carry
 * dozens of gifts, and every card only needs a way to open it with its own id.
 * The cards reach it through context, so nothing between the page and the
 * card has to know copying exists.
 */

type Target = { itemId: string | null; title: string };

const CopyContext = createContext<((target: Target) => void) | null>(null);

export function CopyProvider({
  handle,
  listKey,
  listName,
  destinations,
  signedIn,
  enabled,
  fromGuide = false,
  children,
}: {
  handle: string;
  listKey: string;
  listName: string;
  /** A guide has no reservations to leave behind, and its reasons come along. */
  fromGuide?: boolean;
  /** The viewer's own lists, newest first. Empty for a first-time visitor. */
  destinations: CopyDestination[];
  signedIn: boolean;
  /** False when the owner has turned copying off; every trigger then hides. */
  enabled: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
  // Bumped on every open, so the form inside starts fresh each time rather than
  // still showing the last gift's confirmation.
  const [opening, setOpening] = useState(0);

  const open = (next: Target) => {
    setTarget(next);
    setOpening((count) => count + 1);
  };

  // Opened once the new target has rendered, so the panel never shows the
  // previous gift's title for a frame.
  useEffect(() => {
    if (opening > 0) dialog.current?.showModal();
  }, [opening]);

  return (
    <CopyContext.Provider value={enabled ? open : null}>
      {children}

      <Modal dialogRef={dialog} size="md" labelledBy="copy-heading">
        {target ? (
          <CopyForm
            key={opening}
            target={target}
            handle={handle}
            listKey={listKey}
            listName={listName}
            destinations={destinations}
            signedIn={signedIn}
            fromGuide={fromGuide}
            close={() => dialog.current?.close()}
          />
        ) : null}
      </Modal>
    </CopyContext.Provider>
  );
}

function CopyForm({
  target,
  handle,
  listKey,
  listName,
  destinations,
  signedIn,
  fromGuide,
  close,
}: {
  target: Target;
  handle: string;
  listKey: string;
  listName: string;
  destinations: CopyDestination[];
  signedIn: boolean;
  fromGuide: boolean;
  close: () => void;
}) {
  const [state, action, pending] = useActionState<CopyState, FormData>(copyToList, {});
  // The newest list is the likeliest place for something just found; a
  // first-time visitor has nowhere else to put it.
  const [destination, setDestination] = useState(destinations[0]?.id ?? "new");

  const wholeList = target.itemId === null;

  if (state.added) {
    const { count, listName: addedTo, href } = state.added;
    return (
      <div className="p-7">
        <p className="mb-2 rounded-control bg-pine-wash py-2.5 pl-3.5 pr-12 text-xs font-semibold text-pine-dark">
          ✓ {count === 1 ? "1 gift" : `${count} gifts`} added to {addedTo}
        </p>
        <h2
          id="copy-heading"
          className="mb-2 font-display text-2xl leading-tight tracking-[-0.02em]"
        >
          It&rsquo;s on your list
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-ink-76">
          It&rsquo;s yours to change now. Edit it, move it or take it off, and
          nothing happens to this list.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={close} className="text-sm font-semibold text-ink-72">
            Keep browsing
          </button>
          <Link
            href={href}
            className="rounded-pill bg-violet px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-violet-hover"
          >
            Open {addedTo}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="p-7">
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="key" value={listKey} />
      <input type="hidden" name="itemId" value={target.itemId ?? ""} />

      <h2
        id="copy-heading"
        className="mb-1 pr-10 font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]"
      >
        {wholeList ? "Copy this list" : "Add to your list"}
      </h2>
      <p className="mb-6 text-sm leading-[1.65] text-ink-76">
        {fromGuide
          ? wholeList
            ? `Every gift on ${listName} comes across, with its link, photo, price and why it's a good pick. Changing your copy never touches the original.`
            : `“${target.title}” goes onto a list of yours, with its link, photo, price and why it's a good pick.`
          : wholeList
            ? `Every gift on ${listName} comes across, with its link, photo and price. Nobody's reservations come with it, and changing your copy never touches the original.`
            : `“${target.title}” goes onto a list of yours, with its link, photo and price. Nobody's reservation comes with it.`}
      </p>

      {destinations.length > 0 ? (
        <fieldset className="mb-5">
          <legend>
            <CapsLabel className="mb-[9px]">Put it on</CapsLabel>
          </legend>
          <div className="flex max-h-[15rem] flex-col gap-[6px] overflow-y-auto">
            {destinations.map((list) => (
              <Choice
                key={list.id}
                value={list.id}
                checked={destination === list.id}
                onChange={setDestination}
              >
                <span className="mr-2">{list.emoji}</span>
                {list.name}
              </Choice>
            ))}
            <Choice value="new" checked={destination === "new"} onChange={setDestination}>
              <span className="mr-2">✨</span>A new list
            </Choice>
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="destination" value="new" />
      )}

      {destination === "new" ? (
        <div className="mb-5">
          <label htmlFor="copy-name">
            <CapsLabel className="mb-[7px]">Call the new list</CapsLabel>
          </label>
          <Input
            id="copy-name"
            name="name"
            maxLength={80}
            defaultValue={wholeList ? listName : "My wishlist"}
            required
          />
          {!signedIn && destinations.length === 0 ? (
            <p className="mt-[7px] text-xs leading-[1.55] text-ink-72">
              No account needed. It&rsquo;s kept in this browser until you make one.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-control bg-rose/10 px-[13px] py-[10px] text-xs font-medium text-rose-dark"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={close} className="text-sm font-semibold text-ink-72">
          Cancel
        </button>
        <Button type="submit" disabled={pending}>
          {pending ? "Copying…" : wholeList ? "Copy the list" : "Add it"}
        </Button>
      </div>
    </form>
  );
}

function Choice({
  value,
  checked,
  onChange,
  children,
}: {
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-control border px-[13px] py-[10px] text-sm font-medium ${
        checked ? "border-violet-edge bg-violet-wash" : "border-ink-line bg-surface"
      }`}
    >
      <input
        type="radio"
        name="destination"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 shrink-0 accent-violet"
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </label>
  );
}

/**
 * The whole-list trigger, for the dark rail on the public list.
 *
 * Quiet on a wishlist, where the page is about buying for its owner, and
 * `prominent` on a gift guide, where copying it is half of what it is for.
 */
export function CopyListButton({ prominent = false }: { prominent?: boolean }) {
  const open = useContext(CopyContext);
  if (!open) return null;

  return (
    <button
      type="button"
      onClick={() => open({ itemId: null, title: "" })}
      className={`w-full rounded-pill py-3 text-sm font-semibold transition-colors duration-150 focus-ring ${
        prominent
          ? "bg-paper text-ink hover:bg-paper-88"
          : "border border-paper-line text-paper hover:bg-paper-fill"
      }`}
    >
      Copy this list to make your own
    </button>
  );
}

/**
 * The per-gift trigger. Quiet on purpose: the card's own button is about
 * getting this for the person whose list it is, and that stays the loudest
 * thing on it.
 */
export function CopyItemButton({
  itemId,
  title,
  label = "+ Add to my list",
  className,
}: {
  itemId: string;
  title: string;
  label?: string;
  /** For a row rather than the foot of a card; replaces the default styling. */
  className?: string;
}) {
  const open = useContext(CopyContext);
  if (!open) return null;

  return (
    <button
      type="button"
      onClick={() => open({ itemId, title })}
      // Same enlarged tap area as the shop link on a gift card.
      className={
        className ??
        "mt-1 self-center py-2 text-xs font-semibold text-ink-62 transition-colors duration-150 hover:text-violet focus-ring"
      }
    >
      {label}
    </button>
  );
}
