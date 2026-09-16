DROP INDEX `lists_slug_unique`;--> statement-breakpoint
ALTER TABLE `lists` ADD `short_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `lists_short_code_unique` ON `lists` (`short_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `lists_owner_slug_idx` ON `lists` (`owner_id`,`slug`);--> statement-breakpoint
--> Hand-edited before first application: SQLite cannot ADD a NOT NULL column
--> without a default, so the (empty) users table is recreated instead. Giving
--> `handle` a DEFAULT '' would have left the table permanently out of step with
--> schema.ts. Dropping the table also drops users_email_unique, recreated below.
DROP TABLE `users`;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`email` text NOT NULL,
	`email_verified_at` integer,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);