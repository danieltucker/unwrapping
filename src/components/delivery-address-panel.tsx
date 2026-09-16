import { BoxIcon } from "@/components/ui";
import type { DeliveryAddress } from "@/lib/reservations";

/**
 * The address a gift can be posted to, for someone sending it directly rather
 * than bringing it.
 *
 * Collapsed by default. Not because it is a secret from the person reading it
 * (they have already reserved a gift from this list), but because a home
 * address sitting open on screen is the kind of thing people would rather not
 * have over their shoulder on a train.
 *
 * `<details>` rather than state: it works before hydration, and the browser
 * already knows how to open a disclosure.
 */
export function DeliveryAddressPanel({
  addresses,
}: {
  addresses: DeliveryAddress[];
}) {
  return (
    <section className="mb-7 flex flex-col gap-2.5">
      {addresses.map((entry) => (
        <details
          key={`${entry.listName}-${entry.address}`}
          className="group rounded-[0.75rem] border border-violet-edge bg-violet-wash px-4 py-[0.8125rem]"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 focus-ring rounded-[0.375rem]">
            <BoxIcon size={17} className="shrink-0 text-violet" />
            <span className="flex-1 text-xs leading-relaxed text-ink/80">
              <strong className="font-semibold">Sending it directly?</strong>{" "}
              {entry.ownerName ?? "The list owner"} shared a delivery address for{" "}
              {entry.listEmoji} {entry.listName}.
            </span>
            <span className="shrink-0 text-xs font-semibold text-violet">
              {/* Both labels exist; CSS picks one, so there is no hydration gap. */}
              <span className="group-open:hidden">Show address</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </summary>

          <address className="mt-3 whitespace-pre-line border-t border-violet-edge pt-3 text-sm not-italic leading-relaxed text-ink">
            {entry.address}
          </address>
        </details>
      ))}
    </section>
  );
}
