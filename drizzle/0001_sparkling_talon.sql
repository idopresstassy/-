ALTER TABLE `books` MODIFY COLUMN `content` text;--> statement-breakpoint
ALTER TABLE `books` ADD `description` text;--> statement-breakpoint
ALTER TABLE `books` ADD `googleDriveUrl` varchar(1000);