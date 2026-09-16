import { CapsLabel, Input } from "@/components/ui";

/**
 * What a group gift is aiming at. Only shown once "let guests chip in together"
 * is on, and defaulted to the gift's own price — most group gifts are just one
 * expensive thing split several ways.
 */
export function GoalField({ defaultValue }: { defaultValue: string }) {
  return (
    <div className="rounded-control border border-rose/25 bg-rose-wash px-[13px] py-[11px]">
      <label htmlFor="goal">
        <CapsLabel className="mb-[5px] text-2xs text-rose-dark">Goal</CapsLabel>
      </label>
      <Input
        id="goal"
        name="goal"
        inputMode="decimal"
        defaultValue={defaultValue}
        placeholder="—"
        className="bg-surface py-[9px] text-sm"
      />
      <p className="mt-[7px] text-2xs leading-[1.5] text-ink-72">
        Guests put in any amount they like. Nothing is charged until the goal is met,
        and you only ever see the total.
      </p>
    </div>
  );
}
