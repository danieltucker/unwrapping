ALTER TABLE `claims` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `claims_user_idx` ON `claims` (`user_id`);