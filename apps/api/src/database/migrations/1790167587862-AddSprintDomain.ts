import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSprintDomain1790167587862 implements MigrationInterface {
  name = 'AddSprintDomain1790167587862';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sprints" ("id" uuid NOT NULL, "workspace_id" uuid NOT NULL, "name" text NOT NULL, "goal" text, "status" text NOT NULL DEFAULT 'planned', "starts_at" TIMESTAMP WITH TIME ZONE, "ends_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "sprints_status_check" CHECK ("status" IN ('planned', 'active', 'completed', 'cancelled')), CONSTRAINT "PK_6800aa2e0f508561812c4b9afb4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "sprints_workspace_status_idx" ON "sprints"  ("workspace_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "sprint_items" ("id" uuid NOT NULL, "sprint_id" uuid NOT NULL, "title" text NOT NULL, "description" text, "status" text NOT NULL DEFAULT 'todo', "owner_workspace_member_id" uuid, "due_at" TIMESTAMP WITH TIME ZONE, "blocker_text" text, "acceptance_criteria" text array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "sprint_items_status_check" CHECK ("status" IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')), CONSTRAINT "PK_8bd25cbf9c547dc5316cf794a0e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "sprint_items_owner_idx" ON "sprint_items"  ("owner_workspace_member_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "sprint_items_sprint_status_idx" ON "sprint_items"  ("sprint_id", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sprints" ADD CONSTRAINT "FK_8377d578af0d41c855635574ddd" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sprint_items" ADD CONSTRAINT "FK_8eabcabc16b8e88ad44040773a6" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sprint_items" ADD CONSTRAINT "FK_a5fbc0895826a5e3cb31a0c2fce" FOREIGN KEY ("owner_workspace_member_id") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sprint_items" DROP CONSTRAINT "FK_a5fbc0895826a5e3cb31a0c2fce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sprint_items" DROP CONSTRAINT "FK_8eabcabc16b8e88ad44040773a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sprints" DROP CONSTRAINT "FK_8377d578af0d41c855635574ddd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."sprint_items_sprint_status_idx"`,
    );
    await queryRunner.query(`DROP INDEX "public"."sprint_items_owner_idx"`);
    await queryRunner.query(`DROP TABLE "sprint_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."sprints_workspace_status_idx"`,
    );
    await queryRunner.query(`DROP TABLE "sprints"`);
  }
}
