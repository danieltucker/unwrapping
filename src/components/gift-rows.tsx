"use client";

import { useState, useTransition } from "react";

import { reorderGifts } from "@/app/lists/[handle]/[slug]/manage/actions";
import { EditGiftDialog } from "@/components/edit-gift-dialog";
import { FundingBar } from "@/components/funding";
import { fundingLine } from "@/lib/funding";
import { formatPrice } from "@/config/site";
import type { Item } from "@/db/schema";

export type EditorRow = {
  /**
   * The gift itself, whole: the edit panel opens over this row rather than on a
   * page of its own, so everything its form needs has to be here already.
   */
  item: Item;
  raisedCents: number;
  contributorCount: number;
  /** Null on a surprise list, where the owner may not know. Never 0 by accident. */
  claimedCount: number | null;
  boughtCount: number | null;
};

type Filter = "all" | "wanted" | "photo" | "group";

const MATCHES: Record<Filter, (row: EditorRow) => boolean> = {
  all: () => true,
  wanted: (row) => row.item.isMostWanted,
  photo: (row) => row.item.needsAttention === "no-photo",
  group: (row) => row.item.isGroupGift,
};

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  wanted: "Most wanted",
  photo: "Needs a photo",
  group: "Group gifts",
};

/**
 * The editor's gift list: filters over what's loaded, and drag-to-reorder that
 * persists an explicit position.
 *
 * The rows shuffle under the cursor as you drag: the order on screen is the
 * order that will be saved, and the write happens once, when the drag ends.
 *
 * Reordering is only offered on the unfiltered list: dragging one row past a
 * hidden one has no meaning the owner could predict.
 */
export function GiftRows({
  rows,
  handle,
  listKey,
}: {
  rows: EditorRow[];
  handle: string;
  listKey: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Held as a string so a fresh server order is trivial to compare against the
  // one on screen. A drag shows immediately and the server confirms it a moment
  // later, so the order is adopted only when the server's own answer changes
  // (an add, a delete, or another tab), never on every render.
  const serverOrder = rows.map((row) => row.item.id).join(",");
  const [order, setOrder] = useState(serverOrder);
  const [lastFromServer, setLastFromServer] = useState(serverOrder);

  if (serverOrder !== lastFromServer) {
    setLastFromServer(serverOrder);
    setOrder(serverOrder);
  }

  const byId = new Map(rows.map((row) => [row.item.id, row]));
  const ordered = order
    .split(",")
    .map((id) => byId.get(id))
    .filter((row): row is EditorRow => row !== undefined);

  const visible = ordered.filter(MATCHES[filter]);
  const canReorder = filter === "all" && ordered.length > 1;

  /** Moves a row on screen only; a drag does this for every row it crosses. */
  function preview(id: string, to: number) {
    const ids = ordered.map((row) => row.item.id);
    const from = ids.indexOf(id);
    if (from === -1 || to < 0 || to >= ids.length || to === from) return;

    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrder(ids.join(","));
  }

  /** Writes whatever ended up on screen, once the dragging stops. */
  function persist(ids: string[]) {
    if (ids.join(",") === lastFromServer) return;

    setError(null);
    startSaving(async () => {
      const result = await reorderGifts(handle, listKey, ids);
      if (result.error) setError(result.error);
    });
  }

  function moveBy(id: string, offset: number) {
    const ids = ordered.map((row) => row.item.id);
    const from = ids.indexOf(id);
    const to = from + offset;
    if (from === -1 || to < 0 || to >= ids.length) return;

    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrder(ids.join(","));
    persist(ids);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(Object.keys(MATCHES) as Filter[]).map((key) => {
          const count = ordered.filter(MATCHES[key]).length;
          // A filter for something this list doesn't have is just noise.
          if (key !== "all" && count === 0) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-pill px-[13px] pt-[7px] pb-[5px] text-xs font-semibold transition-colors duration-150 ${
                filter === key
                  ? "bg-ink text-paper"
                  : "border border-ink-line-strong bg-surface text-ink-72 hover:bg-ink/[.03]"
              }`}
            >
              {FILTER_LABELS[key]} {count}
            </button>
          );
        })}

        {ordered.length > 1 ? (
          <span className="ml-auto text-xs font-medium text-ink-62">
            {saving
              ? "Saving the order…"
              : canReorder
                ? "Drag to reorder"
                : "Reordering works on the full list"}
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-control bg-rose/10 px-[13px] py-[10px] text-xs font-medium text-rose-dark"
        >
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {visible.map((row, index) => (
          <GiftRow
            key={row.item.id}
            row={row}
            handle={handle}
            listKey={listKey}
            position={index}
            total={visible.length}
            canReorder={canReorder}
            dragging={dragId === row.item.id}
            onDragStart={() => setDragId(row.item.id)}
            onDragEnd={() => {
              setDragId(null);
              persist(ordered.map((entry) => entry.item.id));
            }}
            // The row being dragged across gives up its place straight away.
            onDragOver={() => {
              if (dragId && dragId !== row.item.id) preview(dragId, index);
            }}
            onMove={(offset) => moveBy(row.item.id, offset)}
          />
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-ink-line-strong px-6 py-10 text-center text-sm text-ink-72">
          Nothing matches that filter.
        </p>
      ) : null}
    </>
  );
}

function GiftRow({
  row,
  handle,
  listKey,
  position,
  total,
  canReorder,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onMove,
}: {
  row: EditorRow;
  handle: string;
  listKey: string;
  position: number;
  total: number;
  canReorder: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onMove: (offset: number) => void;
}) {
  const needsPhoto = row.item.needsAttention === "no-photo";
  const photo = row.item.images[row.item.selectedImageIndex] ?? row.item.images[0];

  return (
    <li
      draggable={canReorder}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!canReorder) return;
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => event.preventDefault()}
      className={`flex items-center gap-[15px] rounded-[12px] border px-[15px] py-3 transition-shadow duration-150 ${
        needsPhoto ? "border-amber/30 bg-amber-wash" : "border-ink-line bg-surface"
      } ${dragging ? "opacity-70 shadow-card" : ""}`}
    >
      {canReorder ? (
        <button
          type="button"
          aria-label={`Reorder ${row.item.title}. Position ${position + 1} of ${total}. Use the arrow keys to move it.`}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              onMove(-1);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onMove(1);
            }
          }}
          className="-ml-1 cursor-grab px-1 text-base leading-none text-ink/28 focus-ring hover:text-ink-62"
        >
          ⠿
        </button>
      ) : null}

      <div className="h-[52px] w-11 shrink-0 overflow-hidden rounded-[7px] bg-ink/[.05]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : row.item.emoji ? (
          <span className="flex h-full items-center justify-center text-xl leading-none">
            {row.item.emoji}
          </span>
        ) : (
          <span className="flex h-full items-center justify-center text-center text-2xs leading-tight text-ink-62">
            No
            <br />
            photo
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{row.item.title}</span>
          {row.item.kind === "idea" ? <Badge tone="neutral">Idea</Badge> : null}
          {row.item.isMostWanted ? <Badge tone="violet">Most wanted</Badge> : null}
          {row.item.isGroupGift ? (
            <Badge tone="rose">
              {row.contributorCount > 0
                ? `Group gift · ${row.contributorCount} in`
                : "Group gift"}
            </Badge>
          ) : null}
          {row.item.quantity > 1 ? <Badge tone="neutral">Qty {row.item.quantity}</Badge> : null}
          <ClaimBadge row={row} />
        </div>

        {row.item.isGroupGift && !needsPhoto ? (
          <div className="max-w-[280px]">
            <FundingBar
              raisedCents={row.raisedCents}
              goalCents={row.item.goalCents}
              className="mb-[5px]"
            />
            <p className="text-xs text-ink-72">
              {fundingLine(row.raisedCents, row.item.goalCents)}
            </p>
          </div>
        ) : (
          <p
            className={`text-xs ${needsPhoto ? "font-medium text-amber-dark" : "text-ink-72"}`}
          >
            {needsPhoto
              ? "No photo found. Items with a photo get claimed far more often"
              : row.item.kind === "idea"
                ? // No link, no price and no quantity to report, so the line
                  // says the one thing an owner might want: how many guests
                  // have gone this way. Null on a surprise list.
                  row.claimedCount === null
                    ? "A direction to shop in, not one present"
                    : `${row.claimedCount} ${row.claimedCount === 1 ? "person is" : "people are"} going this way`
                : [
                    row.item.sourceDomain ?? "Added by hand · no link",
                    `qty ${row.item.quantity}`,
                  ].join(" · ")}
          </p>
        )}
      </div>

      <span className="text-base font-semibold">
        {row.item.kind === "idea"
          ? ""
          : row.item.priceCents === null
            ? "-"
            : formatPrice(row.item.priceCents)}
      </span>

      <EditGiftDialog
        item={row.item}
        handle={handle}
        listKey={listKey}
        className={
          needsPhoto
            ? "rounded-pill bg-ink px-4 pt-[7px] pb-[5px] text-xs font-semibold text-paper transition-colors duration-150 hover:bg-ink/90"
            : "rounded-control border border-ink-line px-3 pt-[6px] pb-1 text-xs font-semibold text-ink-72 transition-colors duration-150 hover:bg-ink/[.03]"
        }
      >
        {needsPhoto ? "Fix it" : "Edit"}
      </EditGiftDialog>
    </li>
  );
}

/**
 * What guests have done with this gift; only ever rendered on a list whose
 * owner has turned the surprise off. A null count means they may not know,
 * which is not the same as nothing having happened.
 */
function ClaimBadge({ row }: { row: EditorRow }) {
  if (row.claimedCount === null || row.claimedCount === 0) return null;

  if (row.boughtCount !== null && row.boughtCount >= row.claimedCount) {
    return <Badge tone="pine">✓ Bought</Badge>;
  }

  return (
    <Badge tone="pine">
      {row.item.quantity > 1 ? `${row.claimedCount} of ${row.item.quantity} taken` : "Taken"}
    </Badge>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "violet" | "rose" | "neutral" | "pine";
  children: React.ReactNode;
}) {
  const tones = {
    violet: "bg-violet/10 text-violet-hover",
    rose: "bg-rose/10 text-rose-dark",
    neutral: "bg-ink/[.07] text-ink-72",
    pine: "bg-pine/10 text-pine-dark",
  } as const;

  return (
    <span
      className={`rounded-pill px-2 py-[2px] text-2xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
