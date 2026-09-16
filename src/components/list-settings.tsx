"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  updateListDetails,
  type ListDetailsState,
} from "@/app/lists/[handle]/[slug]/manage/actions";
import {
  ClaimRuleFields,
  DeliveryAddressField,
  PaymentDetailsField,
  ListIdentityFields,
  SurpriseChoice,
} from "@/components/list-fields";
import { Modal } from "@/components/modal";
import { Button, PencilIcon } from "@/components/ui";
import type { ClaimRule } from "@/db/schema";

/** Only what the form needs. The list row itself carries things a browser has no business with. */
export type ListDetails = {
  name: string;
  emoji: string;
  eventDate: string;
  note: string;
  claimRule: ClaimRule;
  surpriseMode: boolean;
  deliveryAddress: string;
  paymentDetails: string;
};

export function ListSettings({
  details,
  handle,
  listKey,
}: {
  details: ListDetails;
  handle: string;
  listKey: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ListDetailsState, FormData>(
    updateListDetails,
    {},
  );

  useEffect(() => {
    if (state.ok) dialog.current?.close();
  }, [state.ok]);

  return (
    <>
      {/* Attached to the title rather than sitting in the button row: it edits
          what the list is, not what you do with it. */}
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label="Edit list details"
        title="Edit list details"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-ink-line bg-surface text-ink-62 transition-colors duration-150 hover:bg-ink/[.03] hover:text-ink focus-ring"
      >
        <PencilIcon />
      </button>

      <Modal dialogRef={dialog} size="lg" labelledBy="list-details-heading">
        {/* Keyed on the save, so the fields pick up whatever came back rather
            than holding the values that were just submitted. */}
        <form action={action} className="p-7" key={String(state.ok)}>
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="key" value={listKey} />

          <h2
            id="list-details-heading"
            className="mb-1 font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]"
          >
            List details
          </h2>
          <p className="mb-6 text-sm leading-[1.65] text-ink-76">
            Rename it, move the date, change who can claim. The share link stays
            the same, so anything already sent still works.
          </p>

          <ListIdentityFields
            defaultName={details.name}
            defaultEmoji={details.emoji}
            defaultEventDate={details.eventDate}
            defaultNote={details.note}
          />
          <DeliveryAddressField defaultValue={details.deliveryAddress} />
          <PaymentDetailsField defaultValue={details.paymentDetails} />
          <ClaimRuleFields value={details.claimRule} />
          <SurpriseChoice defaultOn={details.surpriseMode} />

          {state.error ? (
            <p
              role="alert"
              className="mb-4 rounded-control bg-rose/10 px-[13px] py-[10px] text-xs font-medium text-rose-dark"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="text-sm font-semibold text-ink-72"
            >
              Cancel
            </button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
