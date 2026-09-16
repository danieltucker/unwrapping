import type { ComponentProps, ReactNode } from "react";

/** Shared primitives built straight from the handoff tokens. */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "outline" | "dark";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-violet text-white hover:bg-violet-hover",
  outline: "border border-ink-line-strong bg-surface text-ink hover:bg-ink/[.03]",
  dark: "bg-ink text-paper hover:bg-ink/90",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(
        // Every primary button is a pill; radius is fixed by the system.
        "rounded-pill px-[22px] py-3 text-[13.5px] font-semibold transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-card border border-ink-line bg-paper shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CapsLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "text-[11px] font-semibold uppercase tracking-[.9px] text-ink-66",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cx(
        "w-full rounded-control border border-ink-line-strong bg-surface px-[14px] py-3",
        "text-[14.5px] font-medium text-ink placeholder:text-ink-62 focus-ring",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cx(
        "w-full rounded-control border border-ink-line-strong bg-surface px-[14px] py-3",
        "text-[14px] leading-[1.65] text-ink/85 placeholder:text-ink-62 focus-ring",
        className,
      )}
      {...props}
    />
  );
}

/** The eye-off mark that carries the surprise guarantee everywhere it appears. */
export function EyeOffIcon({
  size = 18,
  className,
  stroke = "currentColor",
}: {
  size?: number;
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.8}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A9 9 0 0 1 12 5c5 0 9 5 9 7 0 .6-.4 1.6-1.2 2.6" />
      <path d="M6.3 7.1C3.9 8.6 3 11 3 12c0 2 4 7 9 7 1.6 0 3-.5 4.2-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

/** "You'll never see who claimed what" — the violet-wash panel from screen 03. */
export function SurprisePanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-violet-edge bg-violet-wash px-4 py-[13px]">
      <EyeOffIcon className="shrink-0 text-violet" stroke="currentColor" />
      <p className="text-[12.5px] leading-[1.55] text-ink/80">{children}</p>
    </div>
  );
}
