import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthFoundation1790410000000 implements MigrationInterface {
  name = 'AddAuthFoundation1790410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "password_hash" text
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "email_verified_at"
        TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "users_email_normalized_unique"
      ON "users" (
        LOWER(BTRIM("email"))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_refresh_sessions" (
        "id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "workspace_member_id" uuid,
        "token_hash" text NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "revoke_reason" text,
        "rotated_from_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_auth_refresh_sessions"
          PRIMARY KEY ("id"),

        CONSTRAINT "auth_refresh_sessions_token_hash_unique"
          UNIQUE ("token_hash"),

        CONSTRAINT "auth_refresh_sessions_user_id_fkey"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "auth_refresh_sessions_workspace_member_id_fkey"
          FOREIGN KEY ("workspace_member_id")
          REFERENCES "workspace_members"("id")
          ON DELETE SET NULL,

        CONSTRAINT "auth_refresh_sessions_rotated_from_id_fkey"
          FOREIGN KEY ("rotated_from_id")
          REFERENCES "auth_refresh_sessions"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "auth_refresh_sessions_user_idx"
      ON "auth_refresh_sessions" (
        "user_id"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "auth_refresh_sessions_family_idx"
      ON "auth_refresh_sessions" (
        "family_id"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "auth_refresh_sessions_expires_idx"
      ON "auth_refresh_sessions" (
        "expires_at"
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_otp_challenges" (
        "id" uuid NOT NULL,
        "user_id" uuid,
        "email" text NOT NULL,
        "purpose" text NOT NULL,
        "code_hash" text NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 5,
        "consumed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_auth_otp_challenges"
          PRIMARY KEY ("id"),

        CONSTRAINT "auth_otp_challenges_purpose_check"
          CHECK (
            "purpose" IN (
              'verify_email',
              'reset_password'
            )
          ),

        CONSTRAINT "auth_otp_challenges_user_id_fkey"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "auth_otp_challenges_active_unique"
        ON "auth_otp_challenges" (
                                  LOWER(BTRIM("email")),
                                  "purpose"
          )
        WHERE "consumed_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "auth_otp_challenges_expires_idx"
      ON "auth_otp_challenges" (
        "expires_at"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."auth_otp_challenges_expires_idx"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."auth_otp_challenges_active_unique"
    `);

    await queryRunner.query(`
      DROP TABLE "auth_otp_challenges"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."auth_refresh_sessions_expires_idx"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."auth_refresh_sessions_family_idx"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."auth_refresh_sessions_user_idx"
    `);

    await queryRunner.query(`
      DROP TABLE "auth_refresh_sessions"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."users_email_normalized_unique"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "email_verified_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "password_hash"
    `);
  }
}
