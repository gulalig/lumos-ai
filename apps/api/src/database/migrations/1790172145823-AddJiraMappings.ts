import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJiraMappings1790172145823 implements MigrationInterface {
  name = 'AddJiraMappings1790172145823';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "jira_issue_mappings" ("id" uuid NOT NULL, "sprint_item_id" uuid NOT NULL, "jira_cloud_id" text NOT NULL, "jira_issue_id" text NOT NULL, "jira_issue_key" text NOT NULL, "last_synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "jira_issue_mappings_external_issue_key" UNIQUE ("jira_cloud_id", "jira_issue_id"), CONSTRAINT "REL_a9a52778743763008885409b8b" UNIQUE ("sprint_item_id"), CONSTRAINT "PK_0b36472f93ce2d79fb50dd1e0e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "jira_issue_mappings_issue_key_idx" ON "jira_issue_mappings"  ("jira_issue_key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "jira_sprint_mappings" ("id" uuid NOT NULL, "sprint_id" uuid NOT NULL, "jira_cloud_id" text NOT NULL, "jira_board_id" text NOT NULL, "jira_sprint_id" text NOT NULL, "last_synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "jira_sprint_mappings_external_sprint_key" UNIQUE ("jira_cloud_id", "jira_sprint_id"), CONSTRAINT "REL_a87f509a502c0780c71d4513e5" UNIQUE ("sprint_id"), CONSTRAINT "PK_3f5964ae872a138337b5d6ee845" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "jira_issue_mappings" ADD CONSTRAINT "FK_a9a52778743763008885409b8bc" FOREIGN KEY ("sprint_item_id") REFERENCES "sprint_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jira_sprint_mappings" ADD CONSTRAINT "FK_a87f509a502c0780c71d4513e5c" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jira_sprint_mappings" DROP CONSTRAINT "FK_a87f509a502c0780c71d4513e5c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jira_issue_mappings" DROP CONSTRAINT "FK_a9a52778743763008885409b8bc"`,
    );
    await queryRunner.query(`DROP TABLE "jira_sprint_mappings"`);
    await queryRunner.query(
      `DROP INDEX "public"."jira_issue_mappings_issue_key_idx"`,
    );
    await queryRunner.query(`DROP TABLE "jira_issue_mappings"`);
  }
}
