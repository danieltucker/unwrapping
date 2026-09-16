import { CapsLabel, Input } from "@/components/ui";

/**
 * What a group gift is aiming at. Only shown once "let guests chip in together"
 * is on, and defaulted to the gift's own price; most group gifts are just one
 * expensive thing split several ways.
 *
 * A cash gift is always chipped in on, and its goal is the only amount it has.
 * Leaving it blank is allowed there: "toward the honeymoon" has no finish line.
 */
export function GoalField({
  defaultValue,
  cash = false,
}: {
  defaultValue: string;
  cash?: boolean;
}) {
  return (
    <div className="rounded-control border border-rose/25 bg-rose-wash px-[13px] py-[11px]">
      <label htmlFor="goal">
        <CapsLabel className="mb-[5px] text-2xs text-rose-dark">
          {cash ? (
            <>
              Target{" "}
              <span className="font-normal normal-case tracking-normal text-ink-62">
                (optional)
              </span>
            </>
          ) : (
            "Goal"
          )}
        </CapsLabel>
      </label>
      <Input
        id="goal"
        name="goal"
        inputMode="decimal"
        defaultValue={cash ? "" : defaultValue}
        placeholder="-"
        className="bg-surface py-[9px] text-sm"
      />
      <p className="mt-[7px] text-2xs leading-[1.5] text-ink-72">
        {cash
          ? "Guests put in any amount they like. Leave it blank and it just keeps a running total. You only ever see that total, never who gave it."
          : "Guests put in any amount they like. Nothing is charged until the goal is met, and you only ever see the total."}
      </p>
    </div>
  );
}
