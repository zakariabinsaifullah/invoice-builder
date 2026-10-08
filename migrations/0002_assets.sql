CREATE TABLE `asset` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content_type` text NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_user_idx` ON `asset` (`user_id`);