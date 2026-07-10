CREATE TABLE `timeline_event_violation_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeline_event_id` int NOT NULL,
	`violation_tag_id` int NOT NULL,
	`source_quote` text NOT NULL,
	`source_citation` varchar(300),
	`confidence` int NOT NULL DEFAULT 100,
	`added_by` enum('human','goblin','predicate_engine') NOT NULL DEFAULT 'human',
	`added_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timeline_event_violation_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tevt_event_idx` ON `timeline_event_violation_tags` (`timeline_event_id`);--> statement-breakpoint
CREATE INDEX `tevt_tag_idx` ON `timeline_event_violation_tags` (`violation_tag_id`);--> statement-breakpoint
CREATE INDEX `tevt_unique_event_tag` ON `timeline_event_violation_tags` (`timeline_event_id`,`violation_tag_id`);