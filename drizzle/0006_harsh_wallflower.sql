CREATE TABLE `badge_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`label` varchar(200) NOT NULL,
	`description` text,
	`icon` varchar(60),
	`category` enum('contributor','investigator','pioneer','founder','milestone') NOT NULL DEFAULT 'contributor',
	`threshold` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `badge_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `badge_definitions_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `contributor_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`badge_slug` varchar(120) NOT NULL,
	`earned_at` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	CONSTRAINT `contributor_badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contributor_xp` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`action` enum('document_submitted','document_verified','violation_tag_confirmed','first_on_record','pattern_unlock','daily_return','actor_linked','agency_linked') NOT NULL,
	`points` int NOT NULL,
	`document_id` int,
	`actor_id` int,
	`story_id` int,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contributor_xp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`delta` int NOT NULL,
	`reason` enum('subscription_monthly','credit_pack_purchase','goblin_ingest','goblin_chat','admin_grant','refund') NOT NULL,
	`stripe_payment_intent_id` varchar(120),
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cb_user_idx` ON `contributor_badges` (`user_id`);--> statement-breakpoint
CREATE INDEX `cb_slug_idx` ON `contributor_badges` (`badge_slug`);--> statement-breakpoint
CREATE INDEX `cb_unique_idx` ON `contributor_badges` (`user_id`,`badge_slug`);--> statement-breakpoint
CREATE INDEX `cxp_user_idx` ON `contributor_xp` (`user_id`);--> statement-breakpoint
CREATE INDEX `cxp_action_idx` ON `contributor_xp` (`action`);--> statement-breakpoint
CREATE INDEX `cxp_created_idx` ON `contributor_xp` (`created_at`);--> statement-breakpoint
CREATE INDEX `cl_user_idx` ON `credit_ledger` (`user_id`);--> statement-breakpoint
CREATE INDEX `cl_created_idx` ON `credit_ledger` (`created_at`);