CREATE TABLE `actors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(200) NOT NULL,
	`role` varchar(200),
	`agency` varchar(240),
	`bio` text,
	`notes` text,
	`status` enum('documented','alleged','needs_review') NOT NULL DEFAULT 'documented',
	`public_status` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actors_id` PRIMARY KEY(`id`),
	CONSTRAINT `actors_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `agent_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_type` enum('summarize_document','tag_document','summarize_story','tag_story') NOT NULL,
	`status` enum('pending','completed','failed','applied') NOT NULL DEFAULT 'pending',
	`input_document_id` int,
	`input_story_id` int,
	`output_json` json,
	`review_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`file_key` varchar(500) NOT NULL,
	`file_url` varchar(600) NOT NULL,
	`mime_type` varchar(120),
	`file_size` bigint,
	`source_type` enum('court_order','motion','email','transcript','warrant','public_records_response','audio','video','image','jail_record','risk_notice','other') NOT NULL DEFAULT 'other',
	`case_number` varchar(120),
	`document_date` timestamp,
	`actor_names` text,
	`issue_tags` json,
	`story_id` int,
	`public_status` boolean NOT NULL DEFAULT false,
	`review_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`redaction_status` enum('unverified','verified','needs_redaction') NOT NULL DEFAULT 'unverified',
	`uploaded_by` int,
	`ai_summary` text,
	`ai_tags` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `public_records_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`agency` varchar(240) NOT NULL,
	`description` text,
	`date_sent` timestamp,
	`deadline` timestamp,
	`status` enum('draft','sent','awaiting_response','overdue','partial_response','denied','produced','appealed','closed') NOT NULL DEFAULT 'sent',
	`response_summary` text,
	`legal_basis_for_denial` text,
	`linked_documents` json,
	`public_status` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_records_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submitter_name` varchar(200),
	`alias` varchar(120),
	`email` varchar(320),
	`phone` varchar(60),
	`case_number` varchar(120),
	`court` varchar(200),
	`department` varchar(120),
	`judge` varchar(200),
	`prosecutor` varchar(200),
	`defense_attorney` varchar(200),
	`charges` text,
	`date_case_started` timestamp,
	`custody_days` int,
	`still_pending` boolean,
	`trial_held` boolean,
	`requested_trial` boolean,
	`counsel_waived_time` boolean,
	`filings_blocked` boolean,
	`asked_self_rep` boolean,
	`faretta_handled` boolean,
	`competency_raised` boolean,
	`competency_context` text,
	`discovery_missing` boolean,
	`warrants_used` boolean,
	`family_harm` text,
	`summary` text,
	`main_issue` text,
	`public_permission` boolean NOT NULL DEFAULT false,
	`redaction_confirmed` boolean NOT NULL DEFAULT false,
	`status` enum('pending','approved','rejected','needs_changes') NOT NULL DEFAULT 'pending',
	`reviewer_note` text,
	`featured` boolean NOT NULL DEFAULT false,
	`slug` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stories_id` PRIMARY KEY(`id`),
	CONSTRAINT `stories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_date` timestamp NOT NULL,
	`title` varchar(300) NOT NULL,
	`summary` text,
	`case_number` varchar(120),
	`story_id` int,
	`category` enum('state_case','federal_case','custody','motion','warrant','competency','public_records','communications','election_accountability','other') NOT NULL DEFAULT 'other',
	`issue_tags` json,
	`actors` json,
	`status` enum('confirmed','alleged','needs_review') NOT NULL DEFAULT 'needs_review',
	`source_documents` json,
	`public_status` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `timeline_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `documents_source_type_idx` ON `documents` (`source_type`);--> statement-breakpoint
CREATE INDEX `documents_review_idx` ON `documents` (`review_status`);--> statement-breakpoint
CREATE INDEX `documents_public_idx` ON `documents` (`public_status`);--> statement-breakpoint
CREATE INDEX `stories_status_idx` ON `stories` (`status`);--> statement-breakpoint
CREATE INDEX `stories_featured_idx` ON `stories` (`featured`);--> statement-breakpoint
CREATE INDEX `timeline_date_idx` ON `timeline_events` (`event_date`);--> statement-breakpoint
CREATE INDEX `timeline_cat_idx` ON `timeline_events` (`category`);