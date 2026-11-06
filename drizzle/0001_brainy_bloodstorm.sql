CREATE TABLE `qazo_app_data` (
	`userId` int NOT NULL,
	`data` longtext NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qazo_app_data_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `qazo_app_data` ADD CONSTRAINT `qazo_app_data_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;