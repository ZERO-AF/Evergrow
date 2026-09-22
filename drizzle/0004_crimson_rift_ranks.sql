ALTER TABLE `characters` ADD `rank_rift` integer;--> statement-breakpoint
ALTER TABLE `characters` ADD `rank_rift_seconds` real;--> statement-breakpoint
ALTER TABLE `characters` ADD `rank_rift_checked_at` integer;--> statement-breakpoint
CREATE INDEX `characters_rank_rift` ON `characters` (`rank_rift`,`rank_rift_seconds`);