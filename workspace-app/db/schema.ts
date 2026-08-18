import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaceSnapshots = sqliteTable("workspace_snapshots", {
  id: text("id").primaryKey(),
  storageVersion: integer("storage_version").notNull(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
