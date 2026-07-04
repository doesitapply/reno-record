CREATE TABLE `predicate_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`story_id` int NOT NULL,
	`event_id` int,
	`event_date` timestamp,
	`official_act` varchar(500) NOT NULL,
	`actor_name` varchar(300),
	`predicate_status` enum('located','partial','contradicted','not_located','off_record','needs_review') NOT NULL DEFAULT 'needs_review',
	`missing_predicate` text,
	`why_it_matters` text,
	`recommended_request` text,
	`severity_category` enum('liberty','counsel','procedural','administrative') NOT NULL DEFAULT 'procedural',
	`severity_score` int NOT NULL DEFAULT 5,
	`confidence` int NOT NULL DEFAULT 50,
	`source_doc_ids` json,
	`source_event_ids` json,
	`report_version` int NOT NULL DEFAULT 1,
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `predicate_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `predicate_story_idx` ON `predicate_findings` (`story_id`);--> statement-breakpoint
CREATE INDEX `predicate_status_idx` ON `predicate_findings` (`predicate_status`);--> statement-breakpoint
CREATE INDEX `predicate_severity_idx` ON `predicate_findings` (`severity_category`,`severity_score`);--> statement-breakpoint
CREATE INDEX `predicate_event_idx` ON `predicate_findings` (`event_id`);