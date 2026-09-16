"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  addGift,
  previewGift,
  type AddGiftState,
  type PreviewState,
} from "@/app/lists/[slug]/add/actions";
import { Button, CapsLabel, Input, Textarea } from "@/components/ui";
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

export function AddGiftForm({ slug }: { slug: string }) {
  const [preview, previewAction, fetching] = useActionState<PreviewState, FormData>(
    previewGift,
    {},
  );
  const [manual, setManual] = useState<ScrapeResult | null>(null);

  const result = manual ?? preview.result;

  if (fetching) return <Fetching />;
  if (result) {
    return (
      <ConfirmGift
        slug={slug}
        result={result}
        onStartOver={() => setManual(null)}
      />
    );
  }

  return (
    <div className="p-[26px]">
      <h1 className="mb-[6px] font-display text-[28px] leading-[1.1] tracking-[-.7px]">
        Add a gift
      </h1>
      <p className="mb-5 text-[13.5px] leading-[1.65] text-ink-76">
        Paste a link from any shop and we&rsquo;ll fetch the rest.
      </p>

      <form action={previewAction}>
        <input type="hidden" name="slug" value={slug} />
        <Input
          name="url"
          type="text"
          inputMode="url"
          autoFocus
          placeholder="kinto-europe.com/slow-coffee…"
          className="mb-3 font-mono text-[13.5px]"
          aria-label="Link to the gift"
        />
        {preview.error ? (
          <p role="alert" className="mb-3 text-[12.5px] font-medium text-rose-dark">
            {preview.error}
          </p>
        ) : null}
        <p className="mb-5 text-[12.5px] leading-[1.6] text-ink-66">
          Most shops fill in automatically.
        </p>
        <Button type="submit" className="w-full">
          Fetch the details
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-line" />
        <span className="text-[11.5px] font-medium text-ink-62">or</span>
        <span className="h-px flex-1 bg-ink-line" />
      </div>

      {/* The manual route is visible from the first second, by design. */}
      <button
        type="button"
        onClick={() => setManual(EMPTY_MANUAL)}
        className="w-full rounded-control border border-ink-line bg-surface px-[15px] py-[13px] text-left transition-colors duration-150 hover:bg-ink/[.03]"
      >
        <span className="block text-[13.5px] font-semibold">Write it in myself</span>
        <span className="block text-[12px] text-ink-72">
          Title, photo, price, note — no link needed
        </span>
      </button>

      <p className="mt-3 text-[12px] leading-[1.6] text-ink-62">
        Cash goals and the browser button come later.
      </p>
    </div>
  );
}

function Fetching() {
  return (
    <div className="p-[26px]" aria-live="polite">
      <div className="mb-[22px] flex items-center gap-[10px]">
        <span className="h-[15px] w-[15px] animate-spin rounded-pill border-[2.5px] border-violet/25 border-t-violet" />
        <span className="text-[13.5px] font-semibold">Reading the page…</span>
      </div>
      <div className="mb-[22px] flex gap-[15px]">
        <div className="h-[118px] w-[96px] shrink-0 animate-pulse rounded-[9px] bg-ink/[.08]" />
        <div className="flex flex-1 flex-col gap-[9px] pt-[3px]">
          <div className="h-[15px] w-[85%] animate-pulse rounded bg-ink/10" />
          <div className="h-[15px] w-[55%] animate-pulse rounded bg-ink/[.08]" />
          <div className="mt-[5px] h-3 w-[38%] animate-pulse rounded bg-ink/[.06]" />
        </div>
      </div>
      <p className="rounded-control bg-ink/[.04] px-[15px] py-[13px] text-[12.5px] leading-[1.6] text-ink-76">
        Taking too long? We&rsquo;ll keep the link and you can fill it in by hand.
      </p>
    </div>
  );
}

function ConfirmGift({
  slug,
  result,
  onStartOver,
}: {
  slug: string;
  result: ScrapeResult;
  onStartOver: () => void;
}) {
  const [state, action, pending] = useActionState<AddGiftState, FormData>(addGift, {});
  const [selected, setSelected] = useState(0);

  const priceValue =
    result.priceCents !== null ? (result.priceCents / 100).toFixed(2) : "";

  return (
    <form action={action} className="p-[26px]">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="url" value={result.url} />
      <input type="hidden" name="images" value={JSON.stringify(result.images)} />
      <input type="hidden" name="selectedImageIndex" value={selected} />
      <input type="hidden" name="currency" value={result.currency ?? "USD"} />

      {result.error ? (
        <p className="mb-5 rounded-control border border-amber/30 bg-amber-wash px-[13px] py-[10px] text-[12.5px] font-medium text-amber-dark">
          {result.error} The link is kept — fill in what you know.
        </p>
      ) : (
        <p className="mb-5 rounded-control bg-pine-wash px-[13px] py-[10px] text-[12.5px] font-semibold text-pine-dark">
          Filled in — check we picked the right photo
        </p>
      )}

      <div className="mb-[18px] flex gap-[15px]">
        <div className="w-24 shrink-0">
          <div className="mb-2 h-[118px] w-24 overflow-hidden rounded-[9px] bg-ink/[.05]">
            {result.images.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.images[selected]}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center px-2 text-center text-[10px] text-ink-62">
                No photo
              </span>
            )}
          </div>
          {result.images.length > 1 ? (
            <div className="flex gap-[5px]">
              {result.images.slice(0, 4).map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelected(index)}
                  aria-label={`Use photo ${index + 1}`}
                  aria-pressed={index === selected}
                  className={`h-6 w-5 overflow-hidden rounded-[5px] ${
                    index === selected ? "ring-[1.5px] ring-violet" : "opacity-70"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
          <div>
            <label htmlFor="title">
              <CapsLabel className="mb-[5px] text-[10.5px]">Title</CapsLabel>
            </label>
            <Input
              id="title"
              name="title"
              defaultValue={result.title ?? ""}
              required
              maxLength={160}
              className="py-[9px] text-[13.5px]"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="price">
                <CapsLabel className="mb-[5px] text-[10.5px]">Price</CapsLabel>
              </label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={priceValue}
                placeholder="—"
                className="py-[9px] text-[13.5px]"
              />
            </div>
            <div className="w-[72px] shrink-0">
              <label htmlFor="quantity">
                <CapsLabel className="mb-[5px] text-[10.5px]">Qty</CapsLabel>
              </label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                className="py-[9px] text-[13.5px]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="reason">
          <CapsLabel className="mb-[5px] text-[10.5px]">Why you want it</CapsLabel>
        </label>
        {/* This copy is what makes the public list feel personal. */}
        <Textarea
          id="reason"
          name="reason"
          rows={2}
          maxLength={300}
          placeholder="Mine cracked in the move and I've been drinking sad instant coffee since July."
          className="text-[13px]"
        />
      </div>

      <div className="mb-5 flex flex-col gap-2">
        <label className="flex cursor-pointer items-center justify-between rounded-control border border-ink-line bg-surface px-[13px] py-[11px]">
          <span className="text-[13px] font-semibold">Mark as most wanted</span>
          <input type="checkbox" name="isMostWanted" className="h-4 w-4 accent-violet" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-control border border-ink-line bg-surface px-[13px] py-[11px]">
          <span>
            <span className="block text-[13px] font-semibold">
              Let guests chip in together
            </span>
            <span className="block text-[11.5px] text-ink-72">
              Splits the price across several people
            </span>
          </span>
          <input type="checkbox" name="isGroupGift" className="h-4 w-4 accent-violet" />
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="mb-4 text-[12.5px] font-medium text-rose-dark">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-[9px]">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Adding…" : "Add to list"}
        </Button>
        <Link
          href={`/lists/${slug}/add`}
          onClick={onStartOver}
          className="rounded-pill border border-ink-line-strong px-[17px] py-3 text-[14px] font-semibold"
        >
          Start over
        </Link>
      </div>
    </form>
  );
}
