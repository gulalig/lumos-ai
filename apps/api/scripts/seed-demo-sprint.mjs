import { randomUUID } from 'node:crypto';

import appDataSource from '../dist/database/data-source.js';
import { WorkspaceEntity } from '../dist/identity/entities/workspace.entity.js';
import { SprintEntity } from '../dist/sprints/entities/sprint.entity.js';

const DEV_WORKSPACE_ID =
  '22222222-2222-4222-8222-222222222222';

await appDataSource.initialize();

try {
  const workspaces =
    appDataSource.getRepository(
      WorkspaceEntity,
    );

  const sprints =
    appDataSource.getRepository(
      SprintEntity,
    );

  const workspace =
    await workspaces.findOne({
      where: {
        id: DEV_WORKSPACE_ID,
      },
    });

  if (!workspace) {
    throw new Error(
      `Workspace not found: ${DEV_WORKSPACE_ID}`,
    );
  }

  const existingActiveSprint =
    await sprints.findOne({
      where: {
        workspaceId:
        DEV_WORKSPACE_ID,

        status:
          'active',
      },
      order: {
        startsAt:
          'DESC',

        createdAt:
          'DESC',
      },
    });

  if (existingActiveSprint) {
    console.log(
      '\n===== ACTIVE SPRINT ALREADY EXISTS =====',
    );

    console.table([
      {
        id:
        existingActiveSprint.id,

        workspaceId:
        existingActiveSprint.workspaceId,

        name:
        existingActiveSprint.name,

        status:
        existingActiveSprint.status,

        startsAt:
        existingActiveSprint.startsAt,

        endsAt:
        existingActiveSprint.endsAt,
      },
    ]);

    process.exitCode = 0;
  } else {
    const startsAt =
      new Date();

    const endsAt =
      new Date(
        startsAt,
      );

    endsAt.setUTCDate(
      endsAt.getUTCDate() + 14,
    );

    const sprint =
      sprints.create({
        id:
          randomUUID(),

        workspaceId:
        DEV_WORKSPACE_ID,

        name:
          'Lumos Demo Sprint',

        goal:
          'Validate live meeting commitments flowing into execution state.',

        status:
          'active',

        startsAt,

        endsAt,
      });

    const saved =
      await sprints.save(
        sprint,
      );

    console.log(
      '\n===== ACTIVE SPRINT CREATED =====',
    );

    console.table([
      {
        id:
        saved.id,

        workspaceId:
        saved.workspaceId,

        name:
        saved.name,

        status:
        saved.status,

        startsAt:
        saved.startsAt,

        endsAt:
        saved.endsAt,
      },
    ]);
  }
} finally {
  await appDataSource.destroy();
}
