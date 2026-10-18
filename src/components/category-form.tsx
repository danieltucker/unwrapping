"use client";

import { useActionState, useEffect, useState } from "react";

import { saveCategory, type AdminState } from "@/app/admin/actions";
import { Button, CapsLabel, Input, Textarea } from "@/components/ui";

/**
 * Adding or editing one of the shelves on /gifts, from the admin screen.
 *
 * The same form does both: with a category it edits that one in place, and
 * without one it is the "add a category" panel at the top of the section,
 * which empties itself after each save so the next can be typed straight in.
 */

type CategoryFields = {
  id: string;
  name: string;
  slug: string;
  description: string;
  emoji: string;
};

export function CategoryForm({
  category,
  onDone,
}: {
  category?: CategoryFields;
  /** Called after a successful save of an existing category. */
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveCategory, {});

  // The add panel needs nothing here: its fields are uncontrolled, and React
  // empties a form once its action has run. An edit closes back to the row.
  useEffect(() => {
    if (state.ok && category) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-3 rounded-card border border-ink-line bg-surface px-5 py-4"
    >
      {category ? <input type="hidden" name="id" value={category.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[4.5rem_1fr_1fr]">
        <label>
          <CapsLabel className="mb-[5px]">Emoji</CapsLabel>
          <Input
            name="emoji"
            defaultValue={category?.emoji ?? "🎁"}
            maxLength={8}
            className="text-center text-lg"
          />
        </label>
        <label>
          <CapsLabel className="mb-[5px]">Name</CapsLabel>
          <Input
            name="name"
            defaultValue={category?.name}
            placeholder="Outdoors"
            maxLength={40}
            required
          />
        </label>
        <label>
          <CapsLabel className="mb-[5px]">
            Slug{" "}
            <span className="font-normal normal-case tracking-normal text-ink-62">
              {category ? "(changing it breaks old links)" : "(from the name if blank)"}
            </span>
          </CapsLabel>
          <Input
            name="slug"
            defaultValue={category?.slug}
            placeholder="outdoors"
            maxLength={40}
            className="font-mono"
          />
        </label>
      </div>

      <label>
        <CapsLabel className="mb-[5px]">Description</CapsLabel>
        <Textarea
          name="description"
          rows={2}
          maxLength={300}
          defaultValue={category?.description}
          placeholder="For the people who'd rather be up a hill: camping, hiking, climbing and everything that goes in the pack."
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? (
          <p role="alert" className="mr-auto text-xs font-medium text-rose-dark">
            {state.error}
          </p>
        ) : state.ok && !category ? (
          <p className="mr-auto text-xs font-semibold text-pine-dark">✓ {state.message}</p>
        ) : null}
        {category ? (
          <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-72">
            Cancel
          </button>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : category ? "Save category" : "Add category"}
        </Button>
      </div>
    </form>
  );
}

/** One category on the admin screen: read-only until "Edit" turns it into the form. */
export function CategoryRow({
  category,
  guideCount,
  children,
}: {
  category: CategoryFields;
  guideCount: number;
  /** The delete control, rendered by the page so it can share AdminDelete. */
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <CategoryForm category={category} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-card border border-ink-line bg-surface px-5 py-4 sm:flex-nowrap">
      <span className="text-xl leading-none">{category.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{category.name}</p>
        <p className="truncate font-mono text-xs text-violet">/gifts/{category.slug}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-62">
          {guideCount} published {guideCount === 1 ? "list" : "lists"}
          {category.description ? ` · ${category.description}` : " · no description yet"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-pill border border-ink-line-strong px-[13px] py-1.5 text-xs font-semibold text-ink-72 transition-colors duration-150 hover:bg-ink/[.03] focus-ring"
      >
        Edit
      </button>
      {children}
    </li>
  );
}
