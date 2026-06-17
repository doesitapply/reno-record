CREATE TABLE `audit_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`case_number` varchar(160),
	`court` varchar(240),
	`jurisdiction` varchar(160),
	`case_type` enum('criminal','civil','family','administrative','other') NOT NULL DEFAULT 'criminal',
	`description` text NOT NULL,
	`objectives` text,
	`budget` enum('under_500','500_2000','2000_5000','5000_plus','discuss') NOT NULL DEFAULT 'discuss',
	`status` enum('new','reviewing','accepted','declined','completed') NOT NULL DEFAULT 'new',
	`admin_notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_requests_id` PRIMARY KEY(`id`)
);
