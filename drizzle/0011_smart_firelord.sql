CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(160) NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`key_prefix` varchar(24) NOT NULL,
	`scope` enum('read','ingest') NOT NULL DEFAULT 'read',
	`created_by` int,
	`last_used_at` timestamp,
	`use_count` int NOT NULL DEFAULT 0,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_key_hash_unique` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE INDEX `api_keys_hash_idx` ON `api_keys` (`key_hash`);