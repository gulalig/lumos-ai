import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionObservationLinks1790173551168 implements MigrationInterface {
  name = 'AddExecutionObservationLinks1790173551168';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "execution_observation_links" ("observation_id" text NOT NULL, "meeting_id" uuid NOT NULL, "sprint_item_id" uuid NOT NULL, "kind" text NOT NULL, "evidence_event_id" text NOT NULL, "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_38eff3f2cb3bab5000480037b8f" PRIMARY KEY ("observation_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "execution_observation_links_sprint_item_idx" ON "execution_observation_links"  ("sprint_item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "execution_observation_links_meeting_idx" ON "execution_observation_links"  ("meeting_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "execution_observation_links" ADD CONSTRAINT "FK_d075f880bdf0cbf651f30f28bc5" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "execution_observation_links" ADD CONSTRAINT "FK_58e8cb1b21b19338452c370adc2" FOREIGN KEY ("sprint_item_id") REFERENCES "sprint_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "execution_observation_links" DROP CONSTRAINT "FK_58e8cb1b21b19338452c370adc2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "execution_observation_links" DROP CONSTRAINT "FK_d075f880bdf0cbf651f30f28bc5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."execution_observation_links_meeting_idx"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."execution_observation_links_sprint_item_idx"`,
    );
    await queryRunner.query(`DROP TABLE "execution_observation_links"`);
  }
}
