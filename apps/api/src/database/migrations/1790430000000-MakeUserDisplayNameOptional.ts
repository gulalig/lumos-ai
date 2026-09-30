import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeUserDisplayNameOptional1790430000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "display_name"
      DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "display_name" =
        split_part(
          "email",
          '@',
          1
        )
      WHERE "display_name"
        IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "display_name"
      SET NOT NULL
    `);
  }
}
