CREATE TABLE `price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`observed_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `price_history_url_idx` ON `price_history` (`url`,`observed_at`);--> statement-breakpoint
CREATE TABLE `product_checks` (
	`url` text PRIMARY KEY NOT NULL,
	`checked_at` integer NOT NULL,
	`status` text NOT NULL,
	`gone_streak` integer DEFAULT 0 NOT NULL,
	`fail_streak` integer DEFAULT 0 NOT NULL,
	`detail` text
);
--> statement-breakpoint
ALTER TABLE `items` ADD `price_source` text;--> statement-breakpoint
-- Backfill: a price on a gift with a link is assumed to be the shop's own.
-- Nothing recorded which prices were typed by hand before this column existed,
-- and owners rarely retype one the scraper filled in. A price on a gift with
-- no link can only have been typed.
UPDATE `items` SET `price_source` = CASE WHEN `url` IS NOT NULL THEN 'scrape' ELSE 'owner' END WHERE `price_cents` IS NOT NULL;--> statement-breakpoint
-- Backfill: each priced link starts its history at the price it was first
-- added at, so "since it was added" has a baseline from the first recheck on.
INSERT INTO `price_history` (`id`, `url`, `price_cents`, `currency`, `observed_at`)
SELECT lower(hex(randomblob(16))), `url`, `price_cents`, `currency`, `created_at`
FROM (
  SELECT `url`, `price_cents`, `currency`, `created_at`,
    row_number() OVER (PARTITION BY `url` ORDER BY `created_at`) AS `n`
  FROM `items`
  WHERE `url` IS NOT NULL AND `price_cents` IS NOT NULL AND `price_source` = 'scrape'
)
WHERE `n` = 1;
