CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int,
	`actor_role` varchar(32),
	`action` enum('story_submitted','story_approved','story_rejected','story_changes_requested','document_uploaded','document_ingested','document_approved','document_rejected','visibility_changed','ai_policy_changed','admin_role_changed','upload_rejected','rate_limit_triggered') NOT NULL,
	`target_type` varchar(32),
	`target_id` int,
	`metadata` json,
	`ip_hash` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `visibility` enum('private_admin_only','pending_review','needs_redaction','public_preview','receipts_only','goblin_allowed','rejected') DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `ai_policy` enum('no_ai_processing','goblin_allowed') DEFAULT 'no_ai_processing' NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `owner_user_id` int;--> statement-breakpoint
ALTER TABLE `stories` ADD `submitter_ip_hash` varchar(64);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_log` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `stories_owner_idx` ON `stories` (`owner_user_id`);