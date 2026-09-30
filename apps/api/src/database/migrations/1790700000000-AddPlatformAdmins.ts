import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformAdmins1790700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_admins" (
        "id" uuid NOT NULL,
        "email" text NOT NULL,
        "display_name" text NOT NULL,
        "password_hash" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "platform_admins_pkey"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "platform_admins_email_unique"
      ON "platform_admins" (
        LOWER(BTRIM("email"))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."platform_admins_email_unique"
    `);

    await queryRunner.query(`
      DROP TABLE "platform_admins"
    `);
  }
}
