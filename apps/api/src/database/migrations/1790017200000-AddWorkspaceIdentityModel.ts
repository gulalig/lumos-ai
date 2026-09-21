import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceIdentityModel1790017200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "email" text NOT NULL,
        "display_name" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "users_pkey"
          PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "idx_users_email_unique"
      ON "users" (LOWER("email"));
    `);

    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id" uuid NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "workspaces_pkey"
          PRIMARY KEY ("id"),

        CONSTRAINT "workspaces_slug_key"
          UNIQUE ("slug")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "workspace_members" (
        "id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "job_title" text,
        "team_name" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "workspace_members_pkey"
          PRIMARY KEY ("id"),

        CONSTRAINT "workspace_members_role_check"
          CHECK (
            "role" IN (
              'owner',
              'admin',
              'member'
            )
          ),

        CONSTRAINT "workspace_members_workspace_user_key"
          UNIQUE (
            "workspace_id",
            "user_id"
          ),

        CONSTRAINT "workspace_members_workspace_id_fkey"
          FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id")
          ON DELETE CASCADE,

        CONSTRAINT "workspace_members_user_id_fkey"
          FOREIGN KEY ("user_id")
          REFERENCES "users" ("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX
        "idx_workspace_members_workspace_id"
      ON "workspace_members" ("workspace_id");
    `);

    await queryRunner.query(`
      CREATE INDEX
        "idx_workspace_members_user_id"
      ON "workspace_members" ("user_id");
    `);

    await queryRunner.query(`
      ALTER TABLE "meetings"
      ADD COLUMN "workspace_id" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "meetings"
      ADD CONSTRAINT "meetings_workspace_id_fkey"
      FOREIGN KEY ("workspace_id")
      REFERENCES "workspaces" ("id")
      ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      CREATE INDEX
        "idx_meetings_workspace_id"
      ON "meetings" ("workspace_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "meeting_participants" (
        "id" uuid NOT NULL,
        "meeting_id" uuid NOT NULL,
        "workspace_member_id" uuid,
        "participant_type" text NOT NULL DEFAULT 'member',
        "display_name" text NOT NULL,
        "livekit_identity" text NOT NULL,
        "joined_at" timestamptz NOT NULL DEFAULT now(),
        "left_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "meeting_participants_pkey"
          PRIMARY KEY ("id"),

        CONSTRAINT "meeting_participants_type_check"
          CHECK (
            "participant_type" IN (
              'member',
              'guest'
            )
          ),

        CONSTRAINT "meeting_participants_member_check"
          CHECK (
            (
              "participant_type" = 'member'
              AND "workspace_member_id" IS NOT NULL
            )
            OR
            (
              "participant_type" = 'guest'
              AND "workspace_member_id" IS NULL
            )
          ),

        CONSTRAINT "meeting_participants_meeting_identity_key"
          UNIQUE (
            "meeting_id",
            "livekit_identity"
          ),

        CONSTRAINT "meeting_participants_meeting_member_key"
          UNIQUE (
            "meeting_id",
            "workspace_member_id"
          ),

        CONSTRAINT "meeting_participants_meeting_id_fkey"
          FOREIGN KEY ("meeting_id")
          REFERENCES "meetings" ("id")
          ON DELETE CASCADE,

        CONSTRAINT "meeting_participants_workspace_member_id_fkey"
          FOREIGN KEY ("workspace_member_id")
          REFERENCES "workspace_members" ("id")
          ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE INDEX
        "idx_meeting_participants_meeting_id"
      ON "meeting_participants" ("meeting_id");
    `);

    await queryRunner.query(`
      CREATE INDEX
        "idx_meeting_participants_workspace_member_id"
      ON "meeting_participants" ("workspace_member_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "meeting_participants";
    `);

    await queryRunner.query(`
      DROP INDEX "idx_meetings_workspace_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "meetings"
      DROP CONSTRAINT "meetings_workspace_id_fkey";
    `);

    await queryRunner.query(`
      ALTER TABLE "meetings"
      DROP COLUMN "workspace_id";
    `);

    await queryRunner.query(`
      DROP TABLE "workspace_members";
    `);

    await queryRunner.query(`
      DROP TABLE "workspaces";
    `);

    await queryRunner.query(`
      DROP TABLE "users";
    `);
  }
}
