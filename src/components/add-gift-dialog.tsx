"use client";

import { useRef, useState, type ReactNode } from "react";

import { AddGiftForm } from "@/components/add-gift-form";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

/**
 * Adding a gift, over the editor rather than instead of it.
 *
 * A list is built in one sitting, several gifts at a time, and the thing an
 * owner wants in front of them while they do it is the list. Sending them to a
 * page of their own for each one hid it, and made "start over" and "done" both
 * mean navigation.
 *
 * The trigger is whatever the caller passes, because this opens from three
 * places that look nothing alike: the button in the header, the empty list
 * itself, and the dashed strip inside each idea.
 *
 * That third one passes a parentId, which is what turns this from "add a gift"
 * into "add a gift to knitting": the panel drops the choices that make no sense
 * inside an idea, and the gift is written as a child of it. See addGift, which
 * is where that parent is checked rather than trusted.
 */
export function AddGiftDialog({
  handle,
  listKey,
  parentId,
  parentTitle,
  className,
  children,
}: {
  handle: string;
  listKey: string;
  /** Set when adding to an idea rather than to the list itself. */
  parentId?: string;
  /** The idea's title, so the panel can say what it is filling in. */
  parentTitle?: string;
  /** Styles the trigger itself. Without one it is the product's own button. */
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Bumped on the way in, which remounts the form: a panel reopened after
  // adding a gift has to be blank, not still showing the last one.
  const [instance, setInstance] = useState(0);

  function open() {
    setInstance((count) => count + 1);
    dialog.current?.showModal();
  }

  return (
    <>
      {/* The header wants a button among other buttons; the empty list wants to
          be one itself, the whole dashed panel of it. */}
      {className ? (
        <button type="button" onClick={open} className={className}>
          {children}
        </button>
      ) : (
        <Button type="button" onClick={open}>
          {children}
        </Button>
      )}

      {/* The panel's own heading only exists on the first step, so the name
          comes from the dialog itself and holds across all three. */}
      <Modal
        dialogRef={dialog}
        label={parentTitle ? `Add a gift to ${parentTitle}` : "Add a gift"}
      >
        {/* Rendered up front, unlike the edit panel: there is only ever one of
            these, and the paste box being there already is what makes opening
            it feel instant. */}
        <AddGiftForm
          key={instance}
          handle={handle}
          listKey={listKey}
          parentId={parentId}
          parentTitle={parentTitle}
          onDone={() => dialog.current?.close()}
        />
      </Modal>
    </>
  );
}
