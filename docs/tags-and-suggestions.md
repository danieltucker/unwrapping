# Tags, categories and suggestions

A plan for giving every gift a small set of machine-readable tags, and for
spending those tags on three things:

1. **Helping a guest find a gift.** Filters on a long list, and something to
   offer when the thing they wanted is already taken.
2. **Helping an owner build the list.** A thin list is the main reason a list
   goes unused; the fastest fix is to suggest what is missing.
3. **Matching gifts to the occasion.** A retirement list and a baby shower want
   different suggestions, and we already know which is which from the name.

The generation runs against a local Ollama instance on the NAS. Nothing leaves
the network, and nothing here requires a service that can be switched off from
outside.

## The one decision everything else follows from

**The model picks from our vocabulary. It does not invent one.**

Free-form tagging by an LLM produces `coffee`, `Coffee`, `coffee-maker`,
`espresso machine` and `barista gear` for five gifts that are the same thing,
and every filter, every similarity score and every query built on top of that is
quietly broken. The tags look fine in the database and nothing works.

Ollama's `format` parameter takes a JSON Schema and constrains decoding to it.
Put the category list in an `enum` and the model *cannot* return a synonym — not
"is asked not to", cannot. That single constraint is what makes the rest of this
tractable, and it is why the vocabulary is designed first and the prompt last.

So there are two layers:

- **Facets** — a closed, curated vocabulary. Filters, similarity and occasion
  matching only ever read these. Changing them is a code change and a re-run.
- **Free tags** — up to four open strings per gift, normalised and stored but
  never load-bearing. They are the growth path: the ones that keep recurring get
  promoted into the facet vocabulary by hand, every few months, from a query.

## What this builds on

Three things already in the repo do half of this, and the plan extends them
rather than sitting beside them:

- **`GIFT_VOCABULARY` in [`src/lib/emoji.ts`](../src/lib/emoji.ts)** is already an
  item-level taxonomy: twenty categories, each with the keywords that identify
  it. It is the seed for the facet vocabulary, and after this work the emoji
  suggester and the tagger should read from one shared source rather than
  drifting apart.
- **`kind: "idea"` items** already mean "a direction to shop in, not one
  present", with their own section, their own card and a rule that they never run
  out. Generated suggestions become these. There is no second concept to build.
- **The occasion vocabulary in `emoji.ts`** infers the occasion from the list
  name. Note the standing decision there: *"There is deliberately no occasion-type
  selector; the name is the input."* This plan keeps that. The occasion is
  inferred, never asked for.

## Data model

Four tables. SQLite, drizzle, `npm run db:generate` as usual.

```ts
/** The curated facets, plus whatever free tags have been seen. */
export const tags = sqliteTable("tags", {
  id: id(),
  /** "coffee", "outdoors". Lowercase, hyphenated, unique. */
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  /**
   * What kind of thing this says about a gift, which is also its weight when
   * two gifts are compared. An interest ("cycling") says far more about who
   * would like it than a category ("apparel") does.
   */
  kind: text("kind", { enum: ["category", "interest", "attribute"] }).notNull(),
  /** Curated tags are the closed vocabulary; the rest arrived from a model. */
  isCurated: integer("is_curated", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** Synonyms folded onto a curated tag: "coffee maker" and "espresso" → coffee. */
export const tagAliases = sqliteTable("tag_aliases", {
  alias: text("alias").primaryKey(),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
});

export const itemTags = sqliteTable(
  "item_tags",
  {
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    /**
     * Who put it there. This is the important column: a re-run deletes only
     * `model` rows, so an owner's correction survives every future pass. Same
     * rule refetchItem already follows for a price typed by hand.
     */
    source: text("source", { enum: ["model", "owner", "rule"] }).notNull(),
    /** The model's own confidence, kept for tuning the cutoff later. */
    confidence: real("confidence"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] }), index("item_tags_tag_idx").on(t.tagId)],
);

/**
 * One row per item, tracking whether it has been through the tagger. Kept apart
 * from `items` so the queue is a trivial query and the gift row stays about the
 * gift.
 */
export const itemEnrichment = sqliteTable("item_enrichment", {
  itemId: text("item_id").primaryKey().references(() => items.id, { onDelete: "cascade" }),
  state: text("state", { enum: ["pending", "ok", "failed", "skipped"] }).notNull(),
  model: text("model"),
  /** Bumped when the prompt or the vocabulary changes, to find stale rows. */
  promptVersion: integer("prompt_version").notNull().default(1),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

`idea_suggestions` arrives in phase 3; see below.

## When tagging runs

**Never while the owner waits.** A 7B model on a NAS takes seconds to tens of
seconds, and "Add to list" must stay instant. A gift with no tags yet is a gift
that works exactly as it does today, which is the property that makes all of
this safe to ship.

```
addGift / updateItem
  └─ insert item, insert item_enrichment(state: "pending")
  └─ after(() => drainQueue())     ← runs once the response is already sent
```

`after()` from `next/server` runs work after the response flushes, in the same
process. That covers the normal case with no infrastructure at all.

It is not enough on its own: the container restarts, or Ollama is down, and rows
sit pending forever. So `src/instrumentation.ts` registers a sweeper on boot that
drains anything still `pending` — once at startup, then on a slow interval.

Both paths go through one `drainQueue()` with a module-level single-flight lock,
because the NAS is running one model and two concurrent generations make both
slow. A single process and a single SQLite file is the whole deployment; an
in-process promise chain is a correct lock here, and would not be if that ever
changed.

Retries: `attempts < 3`, then `failed`. A failed row is invisible to everyone and
re-runnable from the CLI.

## The LLM boundary

```
src/lib/llm/ollama.ts    the client: chat(), embed(), timeouts, env
src/lib/llm/tagger.ts    prompt + schema + parse for one item
src/lib/llm/ideas.ts     phase 3, generating ideas for a list
src/lib/enrichment.ts    the queue, the lock, the sweeper
src/config/taxonomy.ts   the facet vocabulary, grown from GIFT_VOCABULARY
```

Environment, alongside the existing entries in `.env.example`:

```bash
# Where Ollama is. Unset disables tagging entirely, which is the default: a
# fresh clone must not sit there retrying a connection to a machine that
# isn't there.
# OLLAMA_URL=http://nas.local:11434
# OLLAMA_MODEL=qwen3:8b
```

The request, with the vocabulary inlined as an enum:

```ts
{
  model: process.env.OLLAMA_MODEL,
  stream: false,
  options: { temperature: 0 },
  format: {
    type: "object",
    properties: {
      categories: { type: "array", maxItems: 2, items: { enum: CATEGORY_SLUGS } },
      interests:  { type: "array", maxItems: 3, items: { enum: INTEREST_SLUGS } },
      tags:       { type: "array", maxItems: 4, items: { type: "string" } },
    },
    required: ["categories", "interests", "tags"],
  },
  messages: [{ role: "user", content: prompt(item) }],
}
```

What the prompt gets: the gift's title, the owner's "why you want it" note, the
source domain, and the price band. That is all the signal there is, and it is
enough — the title alone carries most of it.

**What it never gets**, and this is worth a test rather than a comment: anything
about guests. No claims, no names, no contributions, no delivery address, no
payment details. The tagger takes an `Item` and a list name; it is not handed a
`ResolvedList` and cannot reach further by accident.

## Spending the tags

### Guests: filters, and what to do when it's gone

Filter chips on the public list, the same shape as the editor's existing ones in
[`gift-rows.tsx`](../src/components/gift-rows.tsx) — including the rule that
earns them: *a filter for something this list doesn't have is just noise*. Show
them only when the list has enough to sort (say 8+ gifts across 3+ categories
with tags).

The better moment is the one that currently has no answer. A guest opens the list
and the thing they wanted is taken. Today that is a dead end. With tags it is
"Taken — these are close", ranked by similarity among what is still open.

No LLM at request time, ever, on a guest page. It is pure arithmetic over a
handful of rows:

```ts
score(a, b) =
    3 * |shared interests|
  + 2 * |shared categories|
  + 1 * |shared free tags|
  - 1 per price band of distance
```

A list is tens of items, not millions. This is exact, instant, and explainable,
which matters when a suggestion is wrong and you want to know why. Embeddings
are phase 4, and only if this visibly fails.

### Owners: what's missing from this list

A button in the editor, owner-initiated, so a slow answer is a spinner someone
chose to wait for rather than a page that hangs. Input: the list name, the
inferred occasion, and the tags of what is already on it. Output: 5 ideas, each a
title and a sentence of reasoning.

They land in the existing idea concept, via a holding table so the answer is not
thrown away and so dismissals are remembered:

```ts
idea_suggestions: listId, title, rationale, tags, state ("offered" | "accepted" | "dismissed")
```

Accepting one creates an ordinary `kind: "idea"` item. Dismissing one keeps the
row: it is the only negative signal in the system, it stops the same bad idea
being offered twice, and it is the eval set when you want to know whether a
prompt change helped.

### Occasion matching

`occasionFor(listName)` reuses the keyword vocabulary already in `emoji.ts` and
returns one of the curated occasions or null. It feeds two things: a line in the
idea prompt, and a small curated bias map next to `occasions` in
[`src/config/site.ts`](../src/config/site.ts) — baby shower leans to `baby` and
`home`, retirement to `travel`, `garden` and `books`.

Curated, not learned. It is twelve occasions and twenty categories; a table
somebody can read and argue with beats a model call that cannot be reviewed.

## Owner editing

In the edit-gift dialog: the current tags as removable chips, plus an add
control over the curated vocabulary. Owner additions and removals write
`source: "owner"`, and the tagger never touches those rows again.

This is not only a correctness feature. Owner corrections are the only
ground-truth data this system will ever get for free, and `select ... where
source = 'owner'` is both the bug report and the training set.

## Watching it work

Same convention as the scrape log, so one `grep` reaches everything:

```
[tag] ok item=7b1eb538 dur=4210ms model=qwen3:8b categories=kitchen interests=coffee tags=pour-over,gift-for-host
[tag] failed item=0364e671 attempt=2 cause=ECONNREFUSED
```

And the CLI, mirroring `npm run scrape`:

```bash
npm run tag -- <item-id>     # one item, printing the prompt and the raw reply
npm run tag -- --stale       # everything below the current prompt version
npm run tag -- --failed      # retry what gave up
```

The prompt and the raw reply on stdout is the whole debugging story. When a gift
is tagged wrongly, that is the only question worth asking.

## Phases

Each one is shippable and useful alone. **Phase 0 has no LLM in it at all**, on
purpose: it proves the vocabulary and the UI against hand-tagged data, and if it
turns out nobody wants tags, you have spent no time on inference.

| | What | Done when |
|---|---|---|
| **0** | Vocabulary in `taxonomy.ts` grown from `GIFT_VOCABULARY`; the four tables; owner tag editing in the edit dialog; keyword rules (`source: "rule"`) as a free first pass | An owner can tag a gift by hand and the tags persist |
| **1** | Ollama client, tagger, `item_enrichment` queue, `after()` + boot sweeper, `[tag]` logging, `npm run tag` | Adding a gift with a link results in sensible tags within a minute, and Ollama being off changes nothing an owner can see |
| **2** | Guest filter chips; "Taken — these are close" | A guest on a 15-gift list can filter it, and a claimed gift offers three real alternatives |
| **3** | `idea_suggestions`, the idea generator, accept/dismiss into `kind: "idea"` items | An owner with 3 gifts can get 5 ideas and keep two in under a minute |
| **4** | Occasion bias map; promote recurring free tags; embeddings *only if* phase 2 ranking is visibly weak | — |

## Deliberately not doing

- **A vector database.** Tens of items per list. Cosine similarity over a JSON
  blob would already be overkill; a second service is not on the table.
- **Tagging at read time.** Every tag is written once and read thousands of
  times. Nothing on a guest's path may depend on the NAS being awake.
- **An occasion selector.** The list name is the input. That decision is already
  made and this does not reopen it.
- **Letting the model write to the list.** It proposes; the owner accepts. An
  idea nobody accepted is a row in a table, not a gift on a list.

## Open questions

1. **Which model.** `qwen3:8b` is the starting guess for structured output at
   this size; worth trying two or three against the same twenty gifts once
   phase 1 runs. The CLI exists to make that a ten-minute job.
2. **Re-tagging on edit.** Retag when the title changes, or only on demand? Start
   with: title changed → back to `pending`.
3. **Cash and ideas.** A cash gift has nothing to categorise. An idea *is* a
   category, and tagging it may be the single most useful case of all — it is
   how "knitting" connects to a knitting-shaped suggestion.
