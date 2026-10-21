ALTER TABLE `santa_exchanges` ADD `draw_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `santa_participants` ADD `seen_draw` integer;