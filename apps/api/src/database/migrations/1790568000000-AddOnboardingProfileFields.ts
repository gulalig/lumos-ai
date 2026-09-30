import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnboardingProfileFields1790568000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
      ADD COLUMN "industry" text;
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      ADD COLUMN "company_size" text;
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      ADD COLUMN "website" text;
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      ADD COLUMN "primary_use_case" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
      DROP COLUMN "primary_use_case";
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      DROP COLUMN "website";
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      DROP COLUMN "company_size";
    `);

    await queryRunner.query(`
      ALTER TABLE "workspaces"
      DROP COLUMN "industry";
    `);
  }
}
