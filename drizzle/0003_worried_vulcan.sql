ALTER TABLE `contributions` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `contributions_user_idx` ON `contributions` (`user_id`);