CREATE TABLE `boilerplate_phrases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phrase` text NOT NULL,
	`phrase_hash` varchar(64) NOT NULL,
	`occurrence_count` int NOT NULL DEFAULT 0,
	`case_ids` json,
	`judge_name` varchar(200),
	`flagged` boolean NOT NULL DEFAULT false,
	`phrase_category` enum('denial_of_motion','faretta_waiver','competency_finding','continuance_grant','speedy_trial_waiver','pro_se_admonishment','standard_legal_language','other') NOT NULL DEFAULT 'other',
	`significance` text,
	`first_seen` timestamp,
	`last_seen` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `boilerplate_phrases_id` PRIMARY KEY(`id`),
	CONSTRAINT `boilerplate_phrases_phrase_hash_unique` UNIQUE(`phrase_hash`)
);
--> statement-breakpoint
CREATE TABLE `judicial_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`case_number` varchar(120) NOT NULL,
	`judge_name` varchar(200) NOT NULL,
	`department` varchar(60),
	`case_type` enum('criminal_felony','criminal_misdemeanor','civil','family','small_claims','other') NOT NULL DEFAULT 'other',
	`pro_se_flag` boolean NOT NULL DEFAULT false,
	`represented_flag` boolean NOT NULL DEFAULT false,
	`filing_date` timestamp,
	`disposition_date` timestamp,
	`disposition_type` enum('convicted','acquitted','dismissed_with_prejudice','dismissed_without_prejudice','settled','transferred','pending','other') NOT NULL DEFAULT 'pending',
	`ruling_text` text,
	`boilerplate_score` int NOT NULL DEFAULT 0,
	`time_to_ruling_minutes` int,
	`data_source` enum('npra_response','manual_download','public_portal','goblin_ingest') NOT NULL DEFAULT 'manual_download',
	`ingest_status` enum('pending','text_extracted','boilerplate_scored','complete','failed') NOT NULL DEFAULT 'pending',
	`file_key` varchar(500),
	`file_url` varchar(600),
	`notes` text,
	`public_status` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `judicial_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `judicial_cases_case_number_unique` UNIQUE(`case_number`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `case_tag` enum('state','federal','both') DEFAULT 'state' NOT NULL;--> statement-breakpoint
ALTER TABLE `public_records_requests` ADD `case_tag` enum('state','federal','both') DEFAULT 'state' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` varchar(120);--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_subscription_id` varchar(120);--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_tier` enum('free','receipts','goblin_pro','founding','founders_circle') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_status` enum('active','trialing','past_due','cancelled','none') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `goblin_credits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `goblin_used_this_month` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `goblin_free_used` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `bp_hash_idx` ON `boilerplate_phrases` (`phrase_hash`);--> statement-breakpoint
CREATE INDEX `bp_judge_idx` ON `boilerplate_phrases` (`judge_name`);--> statement-breakpoint
CREATE INDEX `bp_flagged_idx` ON `boilerplate_phrases` (`flagged`);--> statement-breakpoint
CREATE INDEX `bp_count_idx` ON `boilerplate_phrases` (`occurrence_count`);--> statement-breakpoint
CREATE INDEX `jc_judge_idx` ON `judicial_cases` (`judge_name`);--> statement-breakpoint
CREATE INDEX `jc_case_type_idx` ON `judicial_cases` (`case_type`);--> statement-breakpoint
CREATE INDEX `jc_pro_se_idx` ON `judicial_cases` (`pro_se_flag`);--> statement-breakpoint
CREATE INDEX `jc_ingest_idx` ON `judicial_cases` (`ingest_status`);--> statement-breakpoint
CREATE INDEX `jc_public_idx` ON `judicial_cases` (`public_status`);