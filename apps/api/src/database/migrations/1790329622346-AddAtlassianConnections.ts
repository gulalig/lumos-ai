import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAtlassianConnections1790329622346 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "atlassian_connections" (
        "id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,

        "cloud_id" text,
        "site_name" text,
        "site_url" text,

        "project_id" text,
        "project_key" text,
        "project_name" text,

        "access_token_encrypted" text,
        "refresh_token_encrypted" text,
        "access_token_expires_at" timestamptz,

        "granted_scopes" text[] NOT NULL DEFAULT '{}',

        "status" text NOT NULL DEFAULT 'pending',
        "last_error" text,

        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "atlassian_connections_pkey"
          PRIMARY KEY ("id"),

        CONSTRAINT "atlassian_connections_workspace_key"
          UNIQUE ("workspace_id"),

        CONSTRAINT "atlassian_connections_status_check"
          CHECK (
            "status" IN (
              'pending',
              'connected',
              'error'
            )
          ),

        CONSTRAINT "atlassian_connections_workspace_id_fkey"
          FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX
        "atlassian_connections_cloud_id_idx"
      ON "atlassian_connections" ("cloud_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX
        "atlassian_connections_cloud_id_idx";
    `);

    await queryRunner.query(`
      DROP TABLE
        "atlassian_connections";
    `);
  }
}
