"use client";

import { useActionState, useId, useState } from "react";

import { Button, Textarea } from "@/components/ui";
import type { SantaState, ThreadMessage } from "@/lib/secret-santa";
import { site } from "@/config/site";

type SantaAction = (previous: SantaState, formData: FormData) => Promise<SantaState>;

// The server and the browser may sit in different time zones, so the time
// element is allowed to differ between them; see suppressHydrationWarning below.
const TIME = new Intl.DateTimeFormat(site.locale, {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * One of a participant's two anonymous threads. The other side is only ever
 * a label handed in by the page — the receiver's name for their Santa, "Your
 * Santa" for the person they drew — because a message carries no sender.
 */
export function SantaThread({
  code,
  to,
  otherLabel,
  messages,
  maxLength,
  send,
  report,
}: {
  code: string;
  to: "receiver" | "santa";
  otherLabel: string;
  messages: ThreadMessage[];
  maxLength: number;
  send: SantaAction;
  report: SantaAction;
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(send, {});
  const [body, setBody] = useState("");
  const counterId = useId();
  const fieldId = useId();

  // Cleared once a message goes, and only then: a refused one stays to be fixed.
  const [answered, setAnswered] = useState(state);
  if (state !== answered) {
    setAnswered(state);
    if (state.ok) setBody("");
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 ? (
        <p className="rounded-control border border-dashed border-ink-line-strong px-4 py-5 text-center text-sm text-ink-72">
          {to === "receiver"
            ? `No messages yet. Ask ${otherLabel} a question — they won't know it's you.`
            : "Nothing from your Santa yet. You can write first: they'll see it, and you won't learn who they are."}
        </p>
      ) : (
        <ol aria-label={`Messages with ${otherLabel}`} aria-live="polite" className="flex flex-col gap-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-card px-4 py-3 ${
                message.mine
                  ? "self-end bg-violet-wash text-ink"
                  : "self-start border border-ink-line bg-surface"
              }`}
            >
              <p className="mb-1 text-2xs font-semibold text-ink-62">
                {message.mine ? "You" : otherLabel} · <time dateTime={message.at.toISOString()} suppressHydrationWarning>{TIME.format(message.at)}</time>
              </p>
              {message.body === null ? (
                <p className="text-sm italic text-ink-62">Removed by the site&rsquo;s operator.</p>
              ) : (
                <p className="whitespace-pre-line break-words text-sm leading-[1.6]">{message.body}</p>
              )}
              {!message.mine && message.body !== null ? (
                message.reportedByMe ? (
                  <p className="mt-1 text-2xs text-ink-62">Reported</p>
                ) : (
                  <ReportButton action={report} code={code} messageId={message.id} />
                )
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <form action={submit} className="flex flex-col gap-2">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="to" value={to} />
        <label htmlFor={fieldId} className="sr-only">
          {to === "receiver" ? `Message to ${otherLabel}` : "Message to your Santa"}
        </label>
        <Textarea
          id={fieldId}
          name="body"
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={maxLength}
          required
          aria-describedby={counterId}
          placeholder={
            to === "receiver" ? "Any allergies? Favourite colour?" : "A hint, a thank-you, a size…"
          }
        />
        <div className="flex items-center justify-between gap-3">
          <span id={counterId} className="text-2xs text-ink-62">
            {body.length} of {maxLength} characters
          </span>
          <Button type="submit" size="sm" disabled={pending || body.trim() === ""}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
        {state.error ? (
          <p role="alert" className="text-xs font-medium text-rose-dark">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function ReportButton({
  action,
  code,
  messageId,
}: {
  action: SantaAction;
  code: string;
  messageId: string;
}) {
  const [state, submit, pending] = useActionState<SantaState, FormData>(action, {});
  return (
    <form action={submit} className="mt-1">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="messageId" value={messageId} />
      <button
        type="submit"
        disabled={pending}
        className="text-2xs font-semibold text-ink-62 underline-offset-2 hover:text-rose hover:underline focus-ring"
      >
        {pending ? "Reporting…" : "Report this message"}
      </button>
      {state.error ? (
        <span role="alert" className="ml-2 text-2xs text-rose-dark">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
