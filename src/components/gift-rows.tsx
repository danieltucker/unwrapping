"use client";

import { useState, useTransition } from "react";

import { reorderGifts } from "@/app/lists/[handle]/[slug]/manage/actions";
import { AddGiftDialog } from "@/components/add-gift-dialog";
import { EditGiftDialog } from "@/components/edit-gift-dialog";
import { FundingBar } from "@/components/funding";
import type { IdeaOption, MovableGift } from "@/components/move-into-idea";
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
  /**
   * The presents hung under this idea, in the owner's order. Empty for
   * everything else: only an idea can hold gifts. See the items table.
   */
  children: EditorRow[];
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

/** Every row on the list, at either level. What the filter chips count. */
function flatten(rows: EditorRow[]): EditorRow[] {
  return rows.flatMap((row) => [row, ...row.children]);
}

/**
 * The editor's gift list: filters over what's loaded, and drag-to-reorder that
 * persists an explicit position.
 *
 * The rows shuffle under the cursor as you drag: the order on screen is the
 * order that will be saved, and the write happens once, when the drag ends.
 *
 * Reordering is only offered on the unfiltered list: dragging one row past a
 * hidden one has no meaning the owner could predict.
 *
 * A present that belongs to an idea is drawn inside it rather than beside it,
 * and sorts among its siblings rather than against the whole list — which is
 * why the ordering lives in RowGroup, one instance per idea plus one for the
 * top level, rather than here.
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
  const [error, setError] = useState<string | null>(null);

  const everything = flatten(rows);

  /**
   * What a move needs, worked out once for the whole list rather than per row:
   * every idea a present could go under, and every present that could go under
   * one.
   *
   * Both are the full list, not the filtered one. A filter decides what is on
   * screen; it has no business deciding what a gift is allowed to belong to.
   */
  const ideas: IdeaOption[] = everything
    .filter((row) => row.item.kind === "idea")
    .map((row) => ({ id: row.item.id, title: row.item.title }));

  const titles = new Map(everything.map((row) => [row.item.id, row.item.title]));

  const movable: MovableGift[] = everything
    .filter((row) => row.item.kind === "thing")
    .map((row) => ({
      id: row.item.id,
      title: row.item.title,
      priceCents: row.item.priceCents,
      image: row.item.images[row.item.selectedImageIndex] ?? row.item.images[0] ?? null,
      emoji: row.item.emoji,
      parentTitle: row.item.parentId
        ? (titles.get(row.item.parentId) ?? null)
        : null,
    }));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(Object.keys(MATCHES) as Filter[]).map((key) => {
          // Counted over the presents inside ideas as well: "needs a photo" is
          // a list of chores, and one hidden inside an idea is still a chore.
          const count = everything.filter(MATCHES[key]).length;
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

        {everything.length > 1 ? (
          <span className="ml-auto text-xs font-medium text-ink-62">
            {filter === "all" ? "Drag to reorder" : "Reordering works on the full list"}
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

      <RowGroup
        rows={rows}
        parentId={null}
        filter={filter}
        ideas={ideas}
        movable={movable}
        handle={handle}
        listKey={listKey}
        onError={setError}
      />

      {everything.filter(MATCHES[filter]).length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-ink-line-strong px-6 py-10 text-center text-sm text-ink-72">
          Nothing matches that filter.
        </p>
      ) : null}
    </>
  );
}

/**
 * One run of siblings, sorted among themselves: the top level of the list, or
 * the presents inside a single idea.
 *
 * Each group keeps its own order, because positions are counted per group — see
 * reorderGifts, which refuses ids from anywhere else. A drag that starts in one
 * group is confined to it as well: the handlers stop the event travelling, so
 * dragging a present around inside an idea never reaches the idea's own row and
 * moves that instead.
 */
function RowGroup({
  rows,
  parentId,
  filter,
  ideas,
  movable,
  handle,
  listKey,
  onError,
}: {
  rows: EditorRow[];
  parentId: string | null;
  filter: Filter;
  /** Every idea on the list, and every present that could move under one. */
  ideas: IdeaOption[];
  movable: MovableGift[];
  handle: string;
  listKey: string;
  onError: (message: string | null) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startSaving] = useTransition();

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

  // An idea stays on screen while one of its presents matches, or the match
  // would have nowhere to be drawn.
  const visible = ordered.filter(
    (row) => MATCHES[filter](row) || row.children.some(MATCHES[filter]),
  );
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

    onError(null);
    startSaving(async () => {
      const result = await reorderGifts(handle, listKey, ids, parentId);
      if (result.error) onError(result.error);
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
    <ul className={`flex flex-col ${parentId === null ? "gap-2" : "gap-[7px]"}`}>
      {visible.map((row, index) => (
        <GiftRow
          key={row.item.id}
          row={row}
          filter={filter}
          ideas={ideas}
          movable={movable}
          handle={handle}
          listKey={listKey}
          nested={parentId !== null}
          position={index}
          total={visible.length}
          canReorder={canReorder}
          dragging={dragId === row.item.id}
          onError={onError}
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
  );
}

function GiftRow({
  row,
  filter,
  ideas,
  movable,
  handle,
  listKey,
  nested,
  position,
  total,
  canReorder,
  dragging,
  onError,
  onDragStart,
  onDragEnd,
  onDragOver,
  onMove,
}: {
  row: EditorRow;
  filter: Filter;
  ideas: IdeaOption[];
  movable: MovableGift[];
  handle: string;
  listKey: string;
  /** A present inside an idea: quieter, and never an idea itself. */
  nested: boolean;
  position: number;
  total: number;
  canReorder: boolean;
  dragging: boolean;
  onError: (message: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onMove: (offset: number) => void;
}) {
  const needsPhoto = row.item.needsAttention === "no-photo";
  const photo = row.item.images[row.item.selectedImageIndex] ?? row.item.images[0];
  const isIdea = row.item.kind === "idea";

  return (
    <li
      draggable={canReorder}
      onDragStart={(event) => {
        // A present inside an idea is its own drag. Without this the idea's row
        // would pick the same gesture up and start moving as well.
        event.stopPropagation();
        onDragStart();
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
      onDragOver={(event) => {
        if (!canReorder) return;
        event.preventDefault();
        event.stopPropagation();
        onDragOver();
      }}
      onDrop={(event) => event.preventDefault()}
      className={`rounded-[12px] border transition-shadow duration-150 ${
        needsPhoto
          ? "border-amber/30 bg-amber-wash"
          : nested
            ? "border-ink-line bg-paper"
            : "border-ink-line bg-surface"
      } ${dragging ? "opacity-70 shadow-card" : ""}`}
    >
      <div
        className={`flex items-center gap-[15px] px-[15px] ${nested ? "py-[9px]" : "py-3"}`}
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

        <div
          className={`shrink-0 overflow-hidden rounded-[7px] bg-ink/[.05] ${
            nested ? "h-[42px] w-9" : "h-[52px] w-11"
          }`}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : row.item.emoji ? (
            <span
              className={`flex h-full items-center justify-center leading-none ${
                nested ? "text-base" : "text-xl"
              }`}
            >
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
            <span className={`font-semibold ${nested ? "text-xs" : "text-sm"}`}>
              {row.item.title}
            </span>
            {isIdea ? <Badge tone="neutral">Idea</Badge> : null}
            {row.item.isMostWanted ? <Badge tone="violet">Most wanted</Badge> : null}
            {row.item.isGroupGift ? (
              <Badge tone="rose">
                {row.contributorCount > 0
                  ? `Group gift · ${row.contributorCount} in`
                  : "Group gift"}
              </Badge>
            ) : null}
            {row.item.quantity > 1 ? (
              <Badge tone="neutral">Qty {row.item.quantity}</Badge>
            ) : null}
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
                : isIdea
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

        <span className={`font-semibold ${nested ? "text-sm" : "text-base"}`}>
          {isIdea
            ? ""
            : row.item.priceCents === null
              ? "-"
              : formatPrice(row.item.priceCents)}
        </span>

        <EditGiftDialog
          item={row.item}
          childCount={row.children.length}
          ideas={ideas}
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
      </div>

      {/* An idea's own presents, inside its box rather than beside it. The
          containment is the point: it is what says these belong to the idea
          above them rather than to the list. */}
      {isIdea ? (
        <div className="border-t border-ink-line px-[15px] py-[11px]">
          <p className="mb-[9px] text-2xs font-semibold uppercase tracking-[1.3px] text-ink-62">
            {row.children.length === 0
              ? "Nothing specific under it yet"
              : `${row.children.length} ${row.children.length === 1 ? "gift" : "gifts"} under this idea`}
          </p>

          {row.children.length > 0 ? (
            <div className="mb-[9px]">
              <RowGroup
                rows={row.children}
                parentId={row.item.id}
                filter={filter}
                ideas={ideas}
                movable={movable}
                handle={handle}
                listKey={listKey}
                onError={onError}
              />
            </div>
          ) : null}

          <AddGiftDialog
            handle={handle}
            listKey={listKey}
            parentId={row.item.id}
            parentTitle={row.item.title}
            // Everything except the presents this idea already holds: offering
            // to move one into where it already is would be a control that
            // does nothing.
            movable={movable.filter(
              (gift) => !row.children.some((child) => child.item.id === gift.id),
            )}
            className="w-full rounded-control border border-dashed border-ink-line-strong px-[13px] py-[9px] text-xs font-semibold text-ink-72 transition-colors duration-150 hover:bg-ink/[.03]"
          >
            + Add a gift to &ldquo;{row.item.title}&rdquo;
          </AddGiftDialog>
        </div>
      ) : null}
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
