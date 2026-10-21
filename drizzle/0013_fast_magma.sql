CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_event_idx` ON `analytics_events` (`event`,`created_at`);--> statement-breakpoint
CREATE TABLE `santa_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`from_giver` integer NOT NULL,
	`body` text NOT NULL,
	`removed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `santa_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `santa_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `santa_messages_assignment_idx` ON `santa_messages` (`assignment_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `santa_messages_sender_idx` ON `santa_messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `santa_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `santa_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `santa_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `santa_reports_message_reporter_idx` ON `santa_reports` (`message_id`,`reporter_id`);