CREATE TABLE `actor_agency_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_id` int NOT NULL,
	`agency_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`start_date` timestamp,
	`end_date` timestamp,
	`is_current` boolean NOT NULL DEFAULT false,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actor_agency_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `actor_document_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_id` int NOT NULL,
	`document_id` int NOT NULL,
	`role` varchar(120),
	`confidence` int NOT NULL DEFAULT 100,
	`extracted_from` varchar(300),
	`added_by` enum('human','goblin') NOT NULL DEFAULT 'human',
	`added_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actor_document_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `actor_timeline_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_id` int NOT NULL,
	`timeline_event_id` int NOT NULL,
	`role` varchar(120),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actor_timeline_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(300) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`agency_type` enum('court','prosecutor','law_enforcement','public_defender','government_department','oversight_body','municipality','state_agency','federal_agency','other') NOT NULL DEFAULT 'other',
	`jurisdiction_name` varchar(200),
	`jurisdiction_type` enum('county','city','state','federal','multi_jurisdictional','other') DEFAULT 'county',
	`state` varchar(60),
	`county` varchar(120),
	`city` varchar(120),
	`parent_agency_id` int,
	`website_url` varchar(500),
	`notes` text,
	`public_status` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `agencies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `document_violation_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`violation_tag_id` int NOT NULL,
	`source_quote` text NOT NULL,
	`source_citation` varchar(300),
	`confidence` int NOT NULL DEFAULT 100,
	`added_by` enum('human','goblin') NOT NULL DEFAULT 'human',
	`added_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_violation_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `violation_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`label` varchar(200) NOT NULL,
	`description` text,
	`category` enum('constitutional','procedural','discovery','judicial_conduct','prosecutorial_conduct','law_enforcement','public_records','civil_rights','other') NOT NULL DEFAULT 'other',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `violation_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `violation_tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `public_records_requests` ADD `status_history` json;--> statement-breakpoint
CREATE INDEX `aar_actor_idx` ON `actor_agency_roles` (`actor_id`);--> statement-breakpoint
CREATE INDEX `aar_agency_idx` ON `actor_agency_roles` (`agency_id`);--> statement-breakpoint
CREATE INDEX `adl_actor_idx` ON `actor_document_links` (`actor_id`);--> statement-breakpoint
CREATE INDEX `adl_document_idx` ON `actor_document_links` (`document_id`);--> statement-breakpoint
CREATE INDEX `atl_actor_idx` ON `actor_timeline_links` (`actor_id`);--> statement-breakpoint
CREATE INDEX `atl_event_idx` ON `actor_timeline_links` (`timeline_event_id`);--> statement-breakpoint
CREATE INDEX `agencies_slug_idx` ON `agencies` (`slug`);--> statement-breakpoint
CREATE INDEX `agencies_type_idx` ON `agencies` (`agency_type`);--> statement-breakpoint
CREATE INDEX `dvt_document_idx` ON `document_violation_tags` (`document_id`);--> statement-breakpoint
CREATE INDEX `dvt_tag_idx` ON `document_violation_tags` (`violation_tag_id`);--> statement-breakpoint
CREATE INDEX `violation_tags_slug_idx` ON `violation_tags` (`slug`);--> statement-breakpoint
CREATE INDEX `violation_tags_category_idx` ON `violation_tags` (`category`);