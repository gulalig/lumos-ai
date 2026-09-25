import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJiraSyncOutbox1790331000000 implements MigrationInterface {
  name = 'AddJiraSyncOutbox1790331000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "jira_sync_outbox" (
        "id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,
        "sprint_item_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "revision" integer NOT NULL DEFAULT 1,
        "attempts" integer NOT NULL DEFAULT 0,
        "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "locked_at" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_jira_sync_outbox"
          PRIMARY KEY ("id"),

        CONSTRAINT "jira_sync_outbox_sprint_item_unique"
          UNIQUE ("sprint_item_id"),

        CONSTRAINT "jira_sync_outbox_status_check"
          CHECK (
            "status" IN (
              'pending',
              'processing',
              'completed'
            )
          ),

        CONSTRAINT "FK_jira_sync_outbox_workspace"
          FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_jira_sync_outbox_sprint_item"
          FOREIGN KEY ("sprint_item_id")
          REFERENCES "sprint_items"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "jira_sync_outbox_available_idx"
      ON "jira_sync_outbox" (
        "status",
        "available_at"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "jira_sync_outbox_workspace_idx"
      ON "jira_sync_outbox" (
        "workspace_id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."jira_sync_outbox_workspace_idx"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."jira_sync_outbox_available_idx"
    `);

    await queryRunner.query(`
      DROP TABLE "jira_sync_outbox"
    `);
  }
}
