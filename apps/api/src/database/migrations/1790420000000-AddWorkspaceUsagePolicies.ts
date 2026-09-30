import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceUsagePolicies1790420000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspace_usage_policies" (
        "workspace_id" uuid NOT NULL,

        "enabled" boolean NOT NULL DEFAULT true,

        "trial_ends_at" timestamptz NULL,

        "monthly_meeting_limit" integer NULL,

        "meeting_creation_enabled" boolean NOT NULL DEFAULT true,

        "livekit_enabled" boolean NOT NULL DEFAULT true,

        "disabled_reason" text NULL,

        "created_at" timestamptz NOT NULL DEFAULT now(),

        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "workspace_usage_policies_pkey"
          PRIMARY KEY ("workspace_id"),

        CONSTRAINT "workspace_usage_policies_workspace_id_fkey"
          FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id")
          ON DELETE CASCADE,

        CONSTRAINT "workspace_usage_policies_monthly_meeting_limit_check"
          CHECK (
            "monthly_meeting_limit" IS NULL
            OR "monthly_meeting_limit" >= 0
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "workspace_usage_policies_trial_ends_at_idx"
      ON "workspace_usage_policies" ("trial_ends_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "workspace_usage_policies_trial_ends_at_idx"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "workspace_usage_policies"
    `);
  }
}
