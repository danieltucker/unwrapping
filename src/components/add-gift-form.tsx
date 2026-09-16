"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import {
  addGift,
  previewGift,
  type AddGiftState,
  type PreviewState,
} from "@/app/lists/[handle]/[slug]/manage/add/actions";
import {
  GiftEmojiField,
  GiftPhotoField,
  GiftUploadDialog,
} from "@/components/gift-photo-fields";
import { GoalField } from "@/components/goal-field";
import { Button, CapsLabel, Input, Textarea } from "@/components/ui";
import { centsToInput } from "@/config/site";
import type { ItemKind } from "@/db/schema";
import type { ScrapeResult } from "@/lib/scrape";

const EMPTY_MANUAL: ScrapeResult = {
  url: "",
  sourceDomain: null,
  title: null,
  priceCents: null,
  currency: null,
  images: [],
  error: null,
};

export function AddGiftForm({
  handle,
  listKey,
  addPath,
}: {
  handle: string;
  listKey: string;
  addPath: string;
}) {
  const [preview, previewAction, fetching] = useActionState<PreviewState, FormData>(
    previewGift,
    {},
  );
  const [manual, setManual] = useState<ScrapeResult | null>(null);
  const [kind, setKind] = useState<ItemKind>("thing");

  const result = manual ?? preview.result;

  if (fetching) return <Fetching />;
  if (result) {
    return (
      <ConfirmGift
        handle={handle}
        listKey={listKey}
        addPath={addPath}
        result={result}
        kind={manual ? kind : "thing"}
        onStartOver={() => setManual(null)}
      />
    );
  }

  return (
    <div className="p-[26px]">
      <h1 className="mb-[6px] font-display text-[1.75rem] leading-[1.1] tracking-[-.7px]">
        Add a gift
      </h1>
      <p className="mb-5 text-sm leading-[1.65] text-ink-76">
        Paste a link from any shop and we&rsquo;ll fetch the rest.
      </p>

      <form action={previewAction}>
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="key" value={listKey} />
        <Input
          name="url"
          type="text"
          inputMode="url"
          autoFocus
          placeholder="kinto-europe.com/slow-coffee…"
          className="mb-3 font-mono text-sm"
          aria-label="Link to the gift"
        />
        {preview.error ? (
          <p role="alert" className="mb-3 text-xs font-medium text-rose-dark">
            {preview.error}
          </p>
        ) : null}
        <p className="mb-5 text-xs leading-[1.6] text-ink-66">
          Most shops fill in automatically.
        </p>
        <Button type="submit" className="w-full">
          Fetch the details
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-line" />
        <span className="text-2xs font-medium text-ink-62">or</span>
        <span className="h-px flex-1 bg-ink-line" />
      </div>

      {/* Both routes past the scraper are visible from the first second. */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setKind("thing");
            setManual(EMPTY_MANUAL);
          }}
          className="w-full rounded-control border border-ink-line bg-surface px-[15px] py-[13px] text-left transition-colors duration-150 hover:bg-ink/[.03]"
        >
          <span className="block text-sm font-semibold">Write it in myself</span>
          <span className="block text-xs text-ink-72">
            Title, photo, price, note: no link needed
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setKind("cash");
            setManual(EMPTY_MANUAL);
          }}
          className="w-full rounded-control border border-ink-line bg-surface px-[15px] py-[13px] text-left transition-colors duration-150 hover:bg-ink/[.03]"
        >
          <span className="block text-sm font-semibold">Ask for money instead</span>
          <span className="block text-xs text-ink-72">
            Toward something big, or just cash. Guests give what they like
          </span>
        </button>
      </div>

      <p className="mt-3 text-xs leading-[1.6] text-ink-62">
        The browser button comes later.
      </p>
    </div>
  );
}

function Fetching() {
  return (
    <div className="p-[26px]" aria-live="polite">
      <div className="mb-[22px] flex items-center gap-[10px]">
        <span className="h-[15px] w-[15px] animate-spin rounded-pill border-[2.5px] border-violet/25 border-t-violet" />
        <span className="text-sm font-semibold">Reading the page…</span>
      </div>
      <div className="mb-[22px] flex gap-[15px]">
        <div className="h-[118px] w-[96px] shrink-0 animate-pulse rounded-[9px] bg-ink/[.08]" />
        <div className="flex flex-1 flex-col gap-[9px] pt-[3px]">
          <div className="h-[15px] w-[85%] animate-pulse rounded bg-ink/10" />
          <div className="h-[15px] w-[55%] animate-pulse rounded bg-ink/[.08]" />
          <div className="mt-[5px] h-3 w-[38%] animate-pulse rounded bg-ink/[.06]" />
        </div>
      </div>
      <p className="rounded-control bg-ink/[.04] px-[15px] py-[13px] text-xs leading-[1.6] text-ink-76">
        Taking too long? We&rsquo;ll keep the link and you can fill it in by hand.
      </p>
    </div>
  );
}

function ConfirmGift({
  handle,
  listKey,
  addPath,
  result,
  kind,
  onStartOver,
}: {
  handle: string;
  listKey: string;
  addPath: string;
  result: ScrapeResult;
  kind: ItemKind;
  onStartOver: () => void;
}) {
  const [state, action, pending] = useActionState<AddGiftState, FormData>(addGift, {});
  // Photos are held here rather than read straight off the scrape, so one the
  // owner uploads joins the candidates before the gift exists to attach it to.
  const [images, setImages] = useState(result.images);
  const [selected, setSelected] = useState(0);
  const [title, setTitle] = useState(result.title ?? "");
  // Cash never has a photo, so it starts with something to look at.
  const [emoji, setEmoji] = useState<string | null>(kind === "cash" ? "💸" : null);
  // A group gift needs a goal, so the field only appears once it's one.
  const [isGroupGift, setIsGroupGift] = useState(false);
  const uploadDialog = useRef<HTMLDialogElement>(null);

  // Cash has no price, no quantity and no choice about chipping in, so those
  // controls are not shown rather than shown and ignored.
  const cash = kind === "cash";

  const priceValue = centsToInput(result.priceCents);

  return (
    <>
      <form action={action} className="p-[26px]">
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="key" value={listKey} />
        <input type="hidden" name="url" value={result.url} />
        <input type="hidden" name="images" value={JSON.stringify(images)} />
        <input type="hidden" name="selectedImageIndex" value={selected} />
        <input type="hidden" name="currency" value={result.currency ?? "USD"} />
        <input type="hidden" name="kind" value={kind} />
        {cash ? <input type="hidden" name="isGroupGift" value="on" /> : null}

        {result.error ? (
          <p className="mb-5 rounded-control border border-amber/30 bg-amber-wash px-[13px] py-[10px] text-xs font-medium text-amber-dark">
            {result.error} The link is kept. Fill in what you know.
          </p>
        ) : cash ? (
          <p className="mb-5 rounded-control bg-rose-wash px-[13px] py-[10px] text-xs font-semibold text-rose-dark">
            Guests put in what they like. Nothing is charged here.
          </p>
        ) : result.url === "" ? (
          /* Nothing was fetched, so there is nothing to check. */
          <p className="mb-5 rounded-control bg-ink/[.04] px-[13px] py-[10px] text-xs font-semibold text-ink-76">
            Write it in yourself. A photo or an emoji helps it get claimed.
          </p>
        ) : (
          <p className="mb-5 rounded-control bg-pine-wash px-[13px] py-[10px] text-xs font-semibold text-pine-dark">
            Filled in. Check we picked the right photo
          </p>
        )}

        <div className="mb-[18px] flex gap-[15px]">
          <GiftPhotoField
            images={images}
            selected={selected}
            onSelect={setSelected}
            emoji={emoji}
            onOpenUpload={() => uploadDialog.current?.showModal()}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
            <div>
              <label htmlFor="title">
                <CapsLabel className="mb-[5px] text-2xs">Title</CapsLabel>
              </label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={cash ? "Toward the honeymoon" : undefined}
                required
                maxLength={160}
                className="py-[9px] text-sm"
              />
            </div>
            {cash ? null : (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="price">
                    <CapsLabel className="mb-[5px] text-2xs">Price</CapsLabel>
                  </label>
                  <Input
                    id="price"
                    name="price"
                    inputMode="decimal"
                    defaultValue={priceValue}
                    placeholder="-"
                    className="py-[9px] text-sm"
                  />
                </div>
                <div className="w-[72px] shrink-0">
                  <label htmlFor="quantity">
                    <CapsLabel className="mb-[5px] text-2xs">Qty</CapsLabel>
                  </label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={1}
                    className="py-[9px] text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <GiftEmojiField title={title} value={emoji} onChange={setEmoji} />

        <div className="mb-4">
          <label htmlFor="reason">
            <CapsLabel className="mb-[5px] text-2xs">
              {cash ? "What it's for" : "Why you want it"}
            </CapsLabel>
          </label>
          {/* This copy is what makes the public list feel personal. */}
          <Textarea
            id="reason"
            name="reason"
            rows={2}
            maxLength={300}
            placeholder={
              cash
                ? "We're putting everything toward the honeymoon, so this helps more than anything wrapped."
                : "Mine cracked in the move and I've been drinking sad instant coffee since July."
            }
            className="text-sm"
          />
        </div>

        <div className="mb-5 flex flex-col gap-2">
          <label className="flex cursor-pointer items-center justify-between rounded-control border border-ink-line bg-surface px-[13px] py-[11px]">
            <span className="text-sm font-semibold">Mark as most wanted</span>
            <input type="checkbox" name="isMostWanted" className="h-4 w-4 accent-violet" />
          </label>
          {cash ? null : (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-control border border-ink-line bg-surface px-[13px] py-[11px]">
              <span>
                <span className="block text-sm font-semibold">
                  Let guests chip in together
                </span>
                <span className="block text-2xs text-ink-72">
                  Splits the price across several people
                </span>
              </span>
              <input
                type="checkbox"
                name="isGroupGift"
                checked={isGroupGift}
                onChange={(event) => setIsGroupGift(event.target.checked)}
                className="h-4 w-4 accent-violet"
              />
            </label>
          )}

          {cash || isGroupGift ? (
            <GoalField defaultValue={priceValue} cash={cash} />
          ) : null}
        </div>

        {state.error ? (
          <p role="alert" className="mb-4 text-xs font-medium text-rose-dark">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center gap-[9px]">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Adding…" : "Add to list"}
          </Button>
          <Link
            href={addPath}
            onClick={onStartOver}
            className="rounded-pill border border-ink-line-strong px-[17px] py-3 text-sm font-semibold"
          >
            Start over
          </Link>
        </div>
      </form>

      {/* Sits outside the form above: a form cannot be nested inside another. */}
      <GiftUploadDialog
        dialogRef={uploadDialog}
        hasPhoto={images.length > 0}
        onUploaded={(url) => {
          // Show what was just chosen, and carry it on the form until the gift
          // is created: there is no item to attach it to yet.
          setImages((current) => [...current, url]);
          setSelected(images.length);
        }}
        handle={handle}
        listKey={listKey}
      />
    </>
  );
}
