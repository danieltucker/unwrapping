CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`emoji` text DEFAULT '🎁' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
ALTER TABLE `lists` ADD `kind` text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE `lists` ADD `category_id` text REFERENCES categories(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `lists` ADD `published_at` integer;--> statement-breakpoint
CREATE INDEX `lists_published_idx` ON `lists` (`kind`,`published_at`);