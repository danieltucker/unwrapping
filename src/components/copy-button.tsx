"use client";

import { useEffect, useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard access can be blocked; leave the label alone rather than
          // claiming a copy that didn't happen.
        }
      }}
      className={
        className ??
        "rounded-pill bg-ink px-[15px] py-2 text-xs font-semibold text-paper transition-colors duration-150 hover:bg-ink/90"
      }
    >
      {copied ? "Copied" : label}
    </button>
  );
}
