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
 * The trigger is whatever the caller passes, because this opens from two places
 * that look nothing alike: the button in the header, and the empty list itself.
 */
export function AddGiftDialog({
  handle,
  listKey,
  className,
  children,
}: {
  handle: string;
  listKey: string;
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
      <Modal dialogRef={dialog} label="Add a gift">
        {/* Rendered up front, unlike the edit panel: there is only ever one of
            these, and the paste box being there already is what makes opening
            it feel instant. */}
        <AddGiftForm
          key={instance}
          handle={handle}
          listKey={listKey}
          onDone={() => dialog.current?.close()}
        />
      </Modal>
    </>
  );
}
