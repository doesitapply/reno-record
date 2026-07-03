CREATE TABLE `actor_news_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_id` int NOT NULL,
	`headline` varchar(500) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`source` varchar(200) NOT NULL,
	`source_tier` enum('local','national') NOT NULL DEFAULT 'national',
	`published_at` timestamp,
	`snippet` text,
	`relevance_score` int NOT NULL DEFAULT 50,
	`misconduct_flag` boolean NOT NULL DEFAULT false,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actor_news_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `actor_news_actor_idx` ON `actor_news_cache` (`actor_id`);--> statement-breakpoint
CREATE INDEX `actor_news_published_idx` ON `actor_news_cache` (`published_at`);