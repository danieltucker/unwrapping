import Link from "next/link";
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
//
// The vertical padding is deliberately 1px lopsided. Gabarito leaves more room
// under the baseline than over the caps, so a label centred by the line box
// reads high; the pair still sums to the same height either way.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-4 pt-[0.6875rem] pb-[0.5625rem] text-xs",
  md: "px-6 pt-[0.8125rem] pb-[0.6875rem] text-sm",
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

/**
 * A link that has to look like a button. Same geometry as Button, so the two
 * sit together in a row without disagreeing on height or label position.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
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

/**
 * The logo: a ribbon still curling after it has been pulled off a present.
 *
 * The geometry is the same path as `src/app/icon.svg`, so the browser tab and
 * the header show one mark rather than two that nearly match. The colors come
 * from the theme rather than from the file, which is why this is drawn inline
 * instead of served as an image.
 */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" className="fill-violet" />
      <path
        d="M31 33.5a3.5 3.5 0 0 1 3.5-3.5a7 7 0 0 1 7 7a10.5 10.5 0 0 1-10.5 10.5a14 14 0 0 1-14-14a17.5 17.5 0 0 1 17.5-17.5a21 21 0 0 1 19 12"
        fill="none"
        className="stroke-paper"
        strokeWidth={6.5}
        strokeLinecap="round"
      />
    </svg>
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


/** Pencil: "edit what this is", as opposed to editing a gift. */
export function PencilIcon({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

/** The chain link that marks anything to do with the share URL. */
export function LinkIcon({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.4 1.4" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 1 0 5.7 5.7l1.4-1.4" />
    </svg>
  );
}

/** A parcel: anything about getting a gift to the door rather than to the list. */
export function BoxIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" />
      <path d="M3 8.5 12 13l9-4.5" />
      <path d="M12 13v7" />
    </svg>
  );
}

/** The X that closes a modal. Always in the same corner, on every one of them. */
export function CloseIcon({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

/** Two figures: a gift several people are going in on, rather than one buyer. */
export function UsersIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 6.3" />
      <path d="M17.8 14.4a5.5 5.5 0 0 1 2.7 4.5" />
    </svg>
  );
}

/** A note of money: everything to do with cash gifts and how to send them. */
export function WalletIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
      <path d="M3 7.5v9A2.5 2.5 0 0 0 5.5 19H19a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5Z" />
      <path d="M16.5 14h.01" />
    </svg>
  );
}
