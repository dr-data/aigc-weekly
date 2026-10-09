import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_weekly\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`summary\` text NOT NULL,
  	\`content\` text NOT NULL,
  	\`issue_number\` text NOT NULL,
  	\`status\` text DEFAULT 'published' NOT NULL,
  	\`publish_date\` text NOT NULL,
  	\`cover_image_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_weekly\`("id", "title", "summary", "content", "issue_number", "status", "publish_date", "cover_image_id", "updated_at", "created_at") SELECT "id", "title", "summary", "content", "issue_number", "status", "publish_date", "cover_image_id", "updated_at", "created_at" FROM \`weekly\`;`)
  await db.run(sql`DROP TABLE \`weekly\`;`)
  await db.run(sql`ALTER TABLE \`__new_weekly\` RENAME TO \`weekly\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`weekly_issue_number_idx\` ON \`weekly\` (\`issue_number\`);`)
  await db.run(sql`CREATE INDEX \`weekly_cover_image_idx\` ON \`weekly\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`weekly_updated_at_idx\` ON \`weekly\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`weekly_created_at_idx\` ON \`weekly\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_weekly\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`summary\` text NOT NULL,
  	\`content\` text NOT NULL,
  	\`issue_number\` text NOT NULL,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`publish_date\` text NOT NULL,
  	\`cover_image_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_weekly\`("id", "title", "summary", "content", "issue_number", "status", "publish_date", "cover_image_id", "updated_at", "created_at") SELECT "id", "title", "summary", "content", "issue_number", "status", "publish_date", "cover_image_id", "updated_at", "created_at" FROM \`weekly\`;`)
  await db.run(sql`DROP TABLE \`weekly\`;`)
  await db.run(sql`ALTER TABLE \`__new_weekly\` RENAME TO \`weekly\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`weekly_issue_number_idx\` ON \`weekly\` (\`issue_number\`);`)
  await db.run(sql`CREATE INDEX \`weekly_cover_image_idx\` ON \`weekly\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`weekly_updated_at_idx\` ON \`weekly\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`weekly_created_at_idx\` ON \`weekly\` (\`created_at\`);`)
}
