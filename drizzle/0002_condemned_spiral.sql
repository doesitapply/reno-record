CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(240),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingest_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`story_id` int,
	`document_id` int,
	`filename` varchar(400) NOT NULL,
	`mime_type` varchar(120),
	`file_size` bigint,
	`status` enum('pending','extracted','drafted','approved','failed') NOT NULL DEFAULT 'pending',
	`extracted_text` text,
	`draft_json` json,
	`timeline_event_id` int,
	`proposed_actors` json,
	`error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingest_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `actors` ADD `judicial_actor` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `chat_messages_session_idx` ON `chat_messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `ingest_jobs_status_idx` ON `ingest_jobs` (`status`);