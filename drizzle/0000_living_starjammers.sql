CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`guest_token` text NOT NULL,
	`first_name` text,
	`marked_bought` integer DEFAULT false NOT NULL,
	`released_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claims_item_idx` ON `claims` (`item_id`);--> statement-breakpoint
CREATE INDEX `claims_guest_idx` ON `claims` (`guest_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `claims_item_guest_live_idx` ON `claims` (`item_id`,`guest_token`) WHERE released_at is null;--> statement-breakpoint
CREATE TABLE `contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`guest_token` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contributions_item_idx` ON `contributions` (`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`source_domain` text,
	`images` text DEFAULT '[]' NOT NULL,
	`selected_image_index` integer DEFAULT 0 NOT NULL,
	`price_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`reason` text,
	`is_most_wanted` integer DEFAULT false NOT NULL,
	`is_group_gift` integer DEFAULT false NOT NULL,
	`goal_cents` integer,
	`needs_attention` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_list_idx` ON `items` (`list_id`,`position`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`draft_token` text,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🎁' NOT NULL,
	`event_date` integer,
	`note` text,
	`claim_rule` text DEFAULT 'anonymous' NOT NULL,
	`surprise_mode` integer DEFAULT true NOT NULL,
	`delivery_address` text,
	`link_opens` integer DEFAULT 0 NOT NULL,
	`shared_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lists_slug_unique` ON `lists` (`slug`);--> statement-breakpoint
CREATE INDEX `lists_owner_idx` ON `lists` (`owner_id`);--> statement-breakpoint
CREATE INDEX `lists_draft_idx` ON `lists` (`draft_token`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified_at` integer,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);