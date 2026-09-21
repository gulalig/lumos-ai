import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMeetingsBaseline1790013499886 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "meetings" (
        "id" uuid NOT NULL,
        "room_name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'created',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "started_at" timestamptz,
        "ended_at" timestamptz,

        CONSTRAINT "meetings_pkey"
          PRIMARY KEY ("id"),

        CONSTRAINT "meetings_room_name_key"
          UNIQUE ("room_name"),

        CONSTRAINT "meetings_status_check"
          CHECK (
            "status" IN (
              'created',
              'active',
              'ended'
            )
          )
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_meetings_created_at"
      ON "meetings" ("created_at" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_meetings_status"
      ON "meetings" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "meetings";
    `);
  }
}
