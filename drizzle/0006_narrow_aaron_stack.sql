ALTER TABLE `items` ADD `parent_id` text REFERENCES items(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX `items_parent_idx` ON `items` (`parent_id`,`position`);