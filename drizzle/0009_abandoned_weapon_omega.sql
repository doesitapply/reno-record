CREATE TABLE `build_log_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(280) NOT NULL,
	`category` enum('ai_automation','ai_agents','systems_architecture','legal_tech','data_pipeline','web_platform','infrastructure','other') NOT NULL DEFAULT 'other',
	`summary` varchar(600),
	`detail_markdown` text,
	`outcome` varchar(400),
	`event_date` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`public_status` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `build_log_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operator_profile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brand` varchar(160) NOT NULL DEFAULT 'Artificially Educated',
	`full_name` varchar(200) NOT NULL DEFAULT 'Cameron Church',
	`role_title` varchar(240),
	`tagline` varchar(400),
	`thesis` text,
	`bio_markdown` text,
	`location` varchar(160),
	`links` json,
	`avatar_key` varchar(400),
	`hero_image_key` varchar(400),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operator_profile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`tagline` varchar(400),
	`description` text,
	`status` enum('live','in_development','beta','concept','archived') NOT NULL DEFAULT 'concept',
	`role` varchar(240),
	`tech_stack` json,
	`live_url` varchar(600),
	`repo_url` varchar(600),
	`thumbnail_key` varchar(400),
	`screenshots` json,
	`parent_brand` varchar(200),
	`featured` boolean NOT NULL DEFAULT false,
	`internal_path` varchar(300),
	`public_status` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `build_log_category_idx` ON `build_log_entries` (`category`);--> statement-breakpoint
CREATE INDEX `build_log_featured_idx` ON `build_log_entries` (`featured`);--> statement-breakpoint
CREATE INDEX `projects_slug_idx` ON `projects` (`slug`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_featured_idx` ON `projects` (`featured`);