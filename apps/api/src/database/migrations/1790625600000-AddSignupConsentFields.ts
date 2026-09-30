import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignupConsentFields1790625600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "terms_accepted_at" timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "newsletter_opt_in" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "newsletter_opt_in"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "terms_accepted_at"
    `);
  }
}
