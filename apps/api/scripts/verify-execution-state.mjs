import appDataSource from '../dist/database/data-source.js';

import { ExecutionObservationLinkEntity } from '../dist/execution/entities/execution-observation-link.entity.js';
import { SprintItemEntity } from '../dist/sprints/entities/sprint-item.entity.js';

const MEETING_ID =
  '4e02e1f6-0d17-4888-91e0-03a16646b92e';

await appDataSource.initialize();

try {
  const links =
    appDataSource.getRepository(
      ExecutionObservationLinkEntity,
    );

  const items =
    appDataSource.getRepository(
      SprintItemEntity,
    );

  const meetingLinks =
    await links.find({
      where: {
        meetingId: MEETING_ID,
      },
      order: {
        appliedAt: 'ASC',
      },
    });

  console.log(
    '\n===== EXECUTION LINKS =====',
  );

  console.table(
    meetingLinks.map(
      (link) => ({
        observationId:
        link.observationId,

        sprintItemId:
        link.sprintItemId,

        kind:
        link.kind,

        evidenceEventId:
        link.evidenceEventId,

        appliedAt:
        link.appliedAt,
      }),
    ),
  );

  const itemIds =
    [
      ...new Set(
        meetingLinks.map(
          (link) =>
            link.sprintItemId,
        ),
      ),
    ];

  const executionItems = [];

  for (
    const itemId of itemIds
    ) {
    const item =
      await items.findOne({
        where: {
          id: itemId,
        },
      });

    if (item) {
      executionItems.push(
        item,
      );
    }
  }

  console.log(
    '\n===== SPRINT ITEMS =====',
  );

  console.table(
    executionItems.map(
      (item) => ({
        id:
        item.id,

        title:
        item.title,

        status:
        item.status,

        owner:
        item.ownerWorkspaceMemberId,

        dueAt:
        item.dueAt,

        sprintId:
        item.sprintId,
      }),
    ),
  );
} finally {
  await appDataSource.destroy();
}
