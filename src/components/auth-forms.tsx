"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, type SignInState } from "@/app/sign-in/actions";
import { signUp, type SignUpState } from "@/app/sign-up/actions";
import { Button, CapsLabel, Input } from "@/components/ui";
import * as routes from "@/lib/routes";

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
      {message}
    </p>
  );
}

export function SignUpForm({ giftCount }: { giftCount: number }) {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, {});

  return (
    <form action={action} className="p-9">
      <h1 className="mb-2 font-display text-[2.25rem] leading-[1.1] tracking-[-1px]">
        Save your list
      </h1>
      <p className="mb-6 text-sm leading-[1.7] text-ink-76">
        {giftCount > 0
          ? `You've added ${giftCount} gift${giftCount === 1 ? "" : "s"} already. An account keeps them, and lets you edit the list after you've shared it.`
          : "An account keeps your lists, and lets you edit them after you've shared them."}
      </p>

      <div className="mb-5 flex flex-col gap-[14px]">
        <div>
          <label htmlFor="name">
            <CapsLabel className="mb-[7px]">Your name</CapsLabel>
          </label>
          <Input id="name" name="name" required maxLength={60} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="email">
            <CapsLabel className="mb-[7px]">Email</CapsLabel>
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
          />
        </div>
        <div>
          <label htmlFor="password">
            <CapsLabel className="mb-[7px]">Password</CapsLabel>
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="mt-[6px] text-2xs text-ink-62">At least 8 characters.</p>
        </div>
      </div>

      <ErrorNote message={state.error} />

      <Button type="submit" disabled={pending} className="mb-4 w-full">
        {pending ? "Saving…" : "Save my list"}
      </Button>

      <p className="text-center text-xs text-ink-66">
        Already have an account?{" "}
        <Link href={routes.signIn} className="font-semibold text-violet">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={action} className="p-9">
      <h1 className="mb-2 font-display text-[2.25rem] leading-[1.1] tracking-[-1px]">
        Welcome back
      </h1>
      <p className="mb-6 text-sm leading-[1.7] text-ink-76">
        Sign in to edit your lists and see what you&rsquo;ve reserved.
      </p>

      <div className="mb-5 flex flex-col gap-[14px]">
        <div>
          <label htmlFor="email">
            <CapsLabel className="mb-[7px]">Email</CapsLabel>
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
          />
        </div>
        <div>
          <label htmlFor="password">
            <CapsLabel className="mb-[7px]">Password</CapsLabel>
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
      </div>

      <ErrorNote message={state.error} />

      <Button type="submit" disabled={pending} className="mb-4 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-ink-66">
        New here?{" "}
        <Link href={routes.signUp} className="font-semibold text-violet">
          Create an account
        </Link>
      </p>
    </form>
  );
}
