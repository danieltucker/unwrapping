"use client";

import { useActionState, useRef, useState } from "react";

import {
  updateAvatar,
  updateProfile,
  type AvatarState,
  type ProfileState,
} from "@/app/profile/actions";
import { Avatar, Button, CapsLabel, Input } from "@/components/ui";
import { formatBytes, uploads } from "@/config/site";

/**
 * The owner's own details: their photo, their name, their birthday.
 *
 * Two forms rather than one, because they fail and succeed separately. A photo
 * is a file that may be too big or the wrong sort of thing entirely, and
 * holding a typed name hostage to it — or losing the photo because the name was
 * blank — is the kind of small betrayal a settings page is remembered for.
 *
 * The handle and the email are shown but not editable. A handle is in the URL
 * of every list they have already shared, and an email is what signs them in;
 * neither is a field to slip in beside a birthday.
 */
export function ProfileForm({
  name,
  email,
  handle,
  avatarUrl,
  birthday,
}: {
  name: string;
  email: string;
  handle: string;
  avatarUrl: string | null;
  /** As an <input type="date"> value, or "" when they haven't said. */
  birthday: string;
}) {
  return (
    <>
      <AvatarSection name={name} avatarUrl={avatarUrl} />
      <DetailsSection name={name} email={email} handle={handle} birthday={birthday} />
    </>
  );
}

function AvatarSection({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState<AvatarState, FormData>(
    async (previous, formData) => {
      try {
        return await updateAvatar(previous, formData);
      } catch (error) {
        // The same guard the gift upload carries: a page left open across a
        // deploy posts to an action id the server no longer has, and losing the
        // whole screen over a photo is the wrong trade.
        console.error("[avatar] the action itself failed:", error);
        return {
          error:
            "That didn't reach us. If this page has been open a while, reload it and try again.",
        };
      }
    },
    {},
  );
  // Measured on the file the picker handed us: sending eight megabytes in order
  // to be told it is too big is a slow way to find out.
  const [tooBig, setTooBig] = useState<string | null>(null);
  const [chosen, setChosen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const problem = tooBig ?? state.error;

  return (
    <section className="mb-6 rounded-card border border-ink-line bg-surface p-5">
      <CapsLabel className="mb-4">Your picture</CapsLabel>

      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={name} url={avatarUrl} size={80} />

        <form action={action} className="min-w-0 flex-1">
          <p className="mb-3 text-xs leading-[1.6] text-ink-72">
            JPEG, PNG, WebP, GIF or AVIF, up to {uploads.maxLabel}. It is shown
            in your own header and nowhere a guest can see: a list never says who
            made it.
          </p>

          <input
            ref={file}
            type="file"
            name="avatar"
            accept={uploads.accept}
            onChange={(event) => {
              const picked = event.target.files?.[0];
              setChosen(Boolean(picked));
              setTooBig(
                picked && picked.size > uploads.maxBytes
                  ? `That photo is ${formatBytes(picked.size)}, and the limit is ${uploads.maxLabel}. Try a smaller one.`
                  : null,
              );
            }}
            className="mb-3 w-full text-xs file:mr-3 file:rounded-pill file:border-0 file:bg-ink/[.06] file:px-4 file:py-2 file:text-xs file:font-semibold"
          />

          {problem ? (
            <p role="alert" className="mb-3 text-xs font-medium text-rose-dark">
              {problem}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={pending || !chosen || tooBig !== null}
            >
              {pending ? "Saving…" : "Save picture"}
            </Button>

            {/* Same action, same form: removing a photo belongs next to
                replacing it rather than somewhere else on the page. */}
            {avatarUrl ? (
              <button
                type="submit"
                name="remove"
                value="on"
                disabled={pending}
                // A file the picker is still holding would be sent along with
                // the removal, which reads as "remove" doing nothing.
                onClick={() => {
                  if (file.current) file.current.value = "";
                  setChosen(false);
                  setTooBig(null);
                }}
                className="text-xs font-medium text-rose-dark underline-offset-2 hover:underline disabled:opacity-60"
              >
                Remove it
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function DetailsSection({
  name,
  email,
  handle,
  birthday,
}: {
  name: string;
  email: string;
  handle: string;
  birthday: string;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    {},
  );

  return (
    <form action={action} className="rounded-card border border-ink-line bg-surface p-5">
      <CapsLabel className="mb-4">Your details</CapsLabel>

      <div className="mb-4 grid gap-[14px] sm:grid-cols-2">
        <div>
          <label htmlFor="name">
            <CapsLabel className="mb-[7px] text-2xs">Name</CapsLabel>
          </label>
          <Input
            id="name"
            name="name"
            defaultValue={name}
            required
            maxLength={80}
            className="py-[10px]"
          />
        </div>

        <div>
          <label htmlFor="birthday">
            <CapsLabel className="mb-[7px] text-2xs">
              Birthday{" "}
              <span className="font-normal normal-case tracking-normal text-ink-62">
                (optional)
              </span>
            </CapsLabel>
          </label>
          <Input
            id="birthday"
            name="birthday"
            type="date"
            defaultValue={birthday}
            className="py-[10px]"
          />
        </div>
      </div>

      <p className="mb-5 text-xs leading-[1.6] text-ink-72">
        Your birthday is yours alone for now: nothing is emailed, nobody is
        reminded, and it never appears on a list. It is here so a birthday list
        can eventually date itself instead of asking you again.
      </p>

      {/* Read-only on purpose, and shown rather than hidden: someone checking
          which email an account is under should not have to sign out to find
          out. */}
      <dl className="mb-5 flex flex-col gap-2 rounded-control bg-ink/[.03] px-[13px] py-[11px] text-xs">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-ink-62">Email</dt>
          <dd className="font-medium">{email}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-ink-62">Your lists live under</dt>
          <dd className="font-mono font-medium">/lists/{handle}/…</dd>
        </div>
      </dl>

      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-control bg-rose/10 px-[13px] py-[10px] text-xs font-medium text-rose-dark"
        >
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p
          className="mb-4 rounded-control bg-pine-wash px-[13px] py-[10px] text-xs font-semibold text-pine-dark"
          aria-live="polite"
        >
          Saved.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
