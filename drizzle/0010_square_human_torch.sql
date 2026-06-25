CREATE TABLE `document_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`version_no` int NOT NULL,
	`snapshot` json NOT NULL,
	`change_note` varchar(600),
	`changed_by` int,
	`changed_by_source` enum('admin','goblin','qc','system','restore') NOT NULL DEFAULT 'system',
	`restored_from_version_no` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `filing_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(320) NOT NULL,
	`docket_entry_no` varchar(80),
	`record_status` enum('on_record_state','on_record_federal','supporting','unfiled_not_on_record','unclassified') NOT NULL DEFAULT 'unclassified',
	`case_number` varchar(120),
	`filed_date` timestamp,
	`description` text,
	`source` enum('goblin','admin') NOT NULL DEFAULT 'goblin',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `filing_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `filing_stamp_date` timestamp;--> statement-breakpoint
ALTER TABLE `documents` ADD `date_source` enum('filing_stamp','file_metadata','inferred','undated') DEFAULT 'undated' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `date_confidence` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `needs_date_review` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `date_source_quote` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `record_status` enum('on_record_state','on_record_federal','supporting','unfiled_not_on_record','unclassified') DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `record_status_confidence` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `record_status_source` enum('goblin','qc','admin','unset') DEFAULT 'unset' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `record_status_reason` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `needs_classification_review` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `filing_package_id` int;--> statement-breakpoint
CREATE INDEX `document_versions_doc_idx` ON `document_versions` (`document_id`);--> statement-breakpoint
CREATE INDEX `document_versions_doc_ver_idx` ON `document_versions` (`document_id`,`version_no`);--> statement-breakpoint
CREATE INDEX `filing_packages_record_status_idx` ON `filing_packages` (`record_status`);--> statement-breakpoint
CREATE INDEX `filing_packages_filed_date_idx` ON `filing_packages` (`filed_date`);--> statement-breakpoint
CREATE INDEX `documents_record_status_idx` ON `documents` (`record_status`);--> statement-breakpoint
CREATE INDEX `documents_filing_package_idx` ON `documents` (`filing_package_id`);--> statement-breakpoint
CREATE INDEX `documents_filing_stamp_idx` ON `documents` (`filing_stamp_date`);