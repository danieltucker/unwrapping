CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_event_drops` (
	`day` text NOT NULL,
	`reason` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `reason`)
);
--> statement-breakpoint
CREATE TABLE `item_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	`event_type` text NOT NULL,
	`visitor_id` text,
	`session_id` text,
	`list_id` text,
	`item_id` text,
	`idea_id` text,
	`properties` text DEFAULT '{}' NOT NULL,
	`is_bot` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`idea_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_events_type_idx` ON `item_events` (`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `item_events_item_idx` ON `item_events` (`item_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `item_events_list_idx` ON `item_events` (`list_id`,`occurred_at`);