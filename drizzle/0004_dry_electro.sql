CREATE TABLE `review_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestor_user_id` int NOT NULL,
	`target_type` enum('story','document') NOT NULL,
	`target_id` int NOT NULL,
	`request_type` enum('removal','correction','redaction','privacy_concern','legal_safety_concern') NOT NULL,
	`status` enum('submitted','under_review','approved','denied','resolved_redaction','resolved_correction','resolved_removal') NOT NULL DEFAULT 'submitted',
	`reason` text NOT NULL,
	`explanation` text,
	`correction_text` text,
	`editorial_note` text,
	`resolved_by` int,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_log` MODIFY COLUMN `action` enum('story_submitted','story_approved','story_rejected','story_changes_requested','document_uploaded','document_ingested','document_approved','document_rejected','visibility_changed','ai_policy_changed','admin_role_changed','upload_rejected','rate_limit_triggered','story_edited','story_soft_deleted','story_hard_deleted','story_restored','document_edited','document_soft_deleted','document_hard_deleted','document_restored','review_request_submitted','review_request_resolved','inline_edit') NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `documents` ADD `deleted_by` int;--> statement-breakpoint
ALTER TABLE `documents` ADD `editorial_note` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `correction_note` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `stories` ADD `deleted_by` int;--> statement-breakpoint
ALTER TABLE `stories` ADD `editorial_note` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `correction_note` text;--> statement-breakpoint
CREATE INDEX `review_req_requestor_idx` ON `review_requests` (`requestor_user_id`);--> statement-breakpoint
CREATE INDEX `review_req_target_idx` ON `review_requests` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `review_req_status_idx` ON `review_requests` (`status`);