import { WalletIcon } from "@/components/ui";

export type PaymentDetails = {
  listName: string;
  listEmoji: string;
  /** First name only: it fronts a line of copy, not a formal record. */
  ownerName: string | null;
  details: string;
};

/**
 * Where to send the money for a cash gift this guest has chipped in on.
 *
 * The product records the amount but never moves it, so without this the
 * chip-in is a promise with no way to keep it. It appears here as well as in
 * the dialog because "I'll do it later" is the normal answer.
 *
 * Collapsed, and `<details>` rather than state, for the same reasons as
 * [DeliveryAddressPanel]: it works before hydration, and a payment handle is
 * not something people want sitting open on a train.
 */
export function PaymentDetailsPanel({ payments }: { payments: PaymentDetails[] }) {
  return (
    <section className="mb-7 flex flex-col gap-2.5">
      {payments.map((entry) => (
        <details
          key={`${entry.listName}-${entry.details}`}
          className="group rounded-[0.75rem] border border-violet-edge bg-violet-wash px-4 py-[0.8125rem]"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[0.375rem] focus-ring">
            <WalletIcon size={17} className="shrink-0 text-violet" />
            <span className="flex-1 text-xs leading-relaxed text-ink/80">
              <strong className="font-semibold">Still to send?</strong>{" "}
              {entry.ownerName ?? "The list owner"} shared how to send money for{" "}
              {entry.listEmoji} {entry.listName}.
            </span>
            <span className="shrink-0 text-xs font-semibold text-violet">
              {/* Both labels exist; CSS picks one, so there is no hydration gap. */}
              <span className="group-open:hidden">Show details</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </summary>

          <p className="mt-3 whitespace-pre-line border-t border-violet-edge pt-3 text-sm leading-relaxed text-ink">
            {entry.details}
          </p>
        </details>
      ))}
    </section>
  );
}
