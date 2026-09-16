import type { ComponentProps, ReactNode } from "react";

/** Shared primitives built straight from the handoff tokens. */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "outline" | "dark";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-violet text-white hover:bg-violet-hover",
  outline: "border border-ink-line-strong bg-surface text-ink hover:bg-ink/[.03]",
  dark: "bg-ink text-paper hover:bg-ink/90",
};

// Sized in rem (Tailwind's scale) rather than px, so buttons grow with the
// reader's browser font size instead of ignoring it. Sizes must match across
// variants or side-by-side buttons disagree on height.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-2.5 text-xs",
  md: "px-6 py-3 text-sm",
};

/** Shared geometry, so any two buttons placed together line up. */
export const buttonBase =
  "inline-flex items-center justify-center rounded-pill font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(
        buttonBase,
        BUTTON_SIZES[size],
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
        "text-2xs font-semibold uppercase tracking-[.9px] text-ink-66",
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
        "text-sm font-medium text-ink placeholder:text-ink-62 focus-ring",
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
        "text-sm leading-[1.65] text-ink/85 placeholder:text-ink-62 focus-ring",
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
      <p className="text-xs leading-[1.55] text-ink/80">{children}</p>
    </div>
  );
}
