CREATE TABLE `book_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`viewerId` varchar(64) NOT NULL,
	`viewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `book_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `book_views_book_viewer_unique` UNIQUE(`bookId`,`viewerId`)
);
