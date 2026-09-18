"use client";

import { useRef, useState, type ReactNode } from "react";

import { EditGiftForm } from "@/components/edit-gift-form";
import { Modal } from "@/components/modal";
import type { IdeaOption } from "@/components/move-into-idea";
import type { Item } from "@/db/schema";

/**
 * Editing one gift, over the row it belongs to.
 *
 * Opening it is a change of mind, not a change of place: the row is still there
 * underneath, and closing the panel puts the owner back exactly where they were
 * in a list they may have scrolled a long way down.
 */
export function EditGiftDialog({
  item,
  childCount,
  ideas,
  handle,
  listKey,
  className,
  children,
}: {
  item: Item;
  /**
   * How many presents this idea holds. Deleting it takes them with it, and
   * that is the one thing about this panel worth warning someone about.
   */
  childCount: number;
  /** Every idea on this list, for the "part of an idea" dropdown. */
  ideas: IdeaOption[];
  handle: string;
  listKey: string;
  /** Styles the trigger: the row's own Edit control, or its amber Fix it. */
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Doubles as "has this ever been opened": every gift on the list renders one
  // of these, and a list of thirty has no business carrying thirty forms nobody
  // has asked for.
  const [instance, setInstance] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // A panel reopened after cancelling out of one must not still be
          // showing the half-typed title from last time.
          setInstance((count) => count + 1);
          dialog.current?.showModal();
        }}
        className={className}
      >
        {children}
      </button>

      <Modal dialogRef={dialog} size="lg" labelledBy={`edit-gift-${item.id}`}>
        <header className="border-b border-ink-line px-[26px] py-5">
          <h2
            id={`edit-gift-${item.id}`}
            className="font-display text-[1.6875rem] leading-[1.1] tracking-[-.7px]"
          >
            {item.kind === "idea" ? "Edit this idea" : "Edit this gift"}
          </h2>
        </header>

        {instance > 0 ? (
          <EditGiftForm
            key={instance}
            item={item}
            childCount={childCount}
            ideas={ideas}
            handle={handle}
            listKey={listKey}
            onDone={() => dialog.current?.close()}
          />
        ) : null}
      </Modal>
    </>
  );
}
