CREATE TABLE `workspace_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_version` integer NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
