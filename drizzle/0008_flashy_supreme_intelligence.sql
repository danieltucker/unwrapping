ALTER TABLE `lists` ADD `allow_copying` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lists` ADD `copied_from_list_id` text REFERENCES lists(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `lists_copied_from_idx` ON `lists` (`copied_from_list_id`);