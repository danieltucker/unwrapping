CREATE TABLE `santa_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`exchange_id` text NOT NULL,
	`giver_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	FOREIGN KEY (`exchange_id`) REFERENCES `santa_exchanges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`giver_id`) REFERENCES `santa_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receiver_id`) REFERENCES `santa_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `santa_assignments_giver_id_unique` ON `santa_assignments` (`giver_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `santa_assignments_receiver_idx` ON `santa_assignments` (`exchange_id`,`receiver_id`);--> statement-breakpoint
CREATE TABLE `santa_exchanges` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🎅' NOT NULL,
	`budget_cents` integer,
	`exchange_date` integer,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`drawn_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `santa_exchanges_code_unique` ON `santa_exchanges` (`code`);--> statement-breakpoint
CREATE INDEX `santa_exchanges_organizer_idx` ON `santa_exchanges` (`organizer_id`);--> statement-breakpoint
CREATE TABLE `santa_exclusions` (
	`id` text PRIMARY KEY NOT NULL,
	`exchange_id` text NOT NULL,
	`first_id` text NOT NULL,
	`second_id` text NOT NULL,
	FOREIGN KEY (`exchange_id`) REFERENCES `santa_exchanges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`first_id`) REFERENCES `santa_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`second_id`) REFERENCES `santa_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `santa_exclusions_pair_idx` ON `santa_exclusions` (`exchange_id`,`first_id`,`second_id`);--> statement-breakpoint
CREATE TABLE `santa_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`exchange_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text,
	`wishlist_id` text,
	`viewed_at` integer,
	`link_reset_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`exchange_id`) REFERENCES `santa_exchanges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`wishlist_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `santa_participants_token_hash_unique` ON `santa_participants` (`token_hash`);--> statement-breakpoint
CREATE INDEX `santa_participants_exchange_idx` ON `santa_participants` (`exchange_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `santa_participants_exchange_user_idx` ON `santa_participants` (`exchange_id`,`user_id`);