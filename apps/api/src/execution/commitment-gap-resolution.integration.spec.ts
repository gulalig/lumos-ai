import { Redis } from 'ioredis';
import type { DataSource, EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';
import { interventionGapId } from '../interventions/intervention-gap.js';
import { InterventionPublisher } from '../interventions/intervention.publisher.js';
import { InterventionService } from '../interventions/intervention.service.js';
import { MeetingEntity } from '../meetings/meeting.entity.js';
import type { RedisService } from '../redis/redis.service.js';
import type { SemanticObservation } from '../semantics/semantic-observation.js';
import { SprintItemEntity } from '../sprints/entities/sprint-item.entity.js';
import { SprintEntity } from '../sprints/entities/sprint.entity.js';

import { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';
import { ExecutionService } from './execution.service.js';
import { JiraSyncOutboxRepository } from '../integrations/jira/jira-sync-outbox.repository.js';

const jiraSyncOutbox = {
  enqueue: vi.fn().mockResolvedValue(undefined),
} as unknown as JiraSyncOutboxRepository;

describe('commitment gap resolution integration', () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');

    await redis.ping();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('creates missing-owner gap then updates the same sprint item and resolves the gap when another participant takes ownership', async () => {
    const meetingId = '44444444-4444-4444-8444-444444444444';

    const workspaceId = '55555555-5555-4555-8555-555555555555';

    const sprintId = '22222222-2222-4222-8222-222222222222';

    const ownerId = '33333333-3333-4333-8333-333333333333';

    const firstObservationId = 'observation-ownerless-e2e';

    const secondObservationId = 'observation-owner-refinement-e2e';

    const firstEvidenceId = 'evidence-ownerless-e2e';

    const secondEvidenceId = 'evidence-owner-refinement-e2e';

    const meeting = new MeetingEntity();

    meeting.id = meetingId;

    meeting.workspaceId = workspaceId;

    const sprint = new SprintEntity();

    sprint.id = sprintId;

    sprint.workspaceId = workspaceId;

    sprint.status = 'active';

    const owner = new WorkspaceMemberEntity();

    owner.id = ownerId;

    owner.workspaceId = workspaceId;

    const state: {
      sprintItem: SprintItemEntity | null;
    } = {
      sprintItem: null,
    };

    const links = new Map<string, ExecutionObservationLinkEntity>();

    const linksRepository = {
      findOne: async (options: {
        where?: {
          observationId?: string;
        };

        relations?: {
          sprintItem?: boolean;
        };
      }) => {
        const observationId = options.where?.observationId;

        if (!observationId) {
          return null;
        }

        const link = links.get(observationId) ?? null;

        if (link && options.relations?.sprintItem) {
          if (!state.sprintItem) {
            throw new Error('Sprint item state is missing');
          }

          link.sprintItem = state.sprintItem;
        }

        return link;
      },

      create: (values: Partial<ExecutionObservationLinkEntity>) =>
        Object.assign(new ExecutionObservationLinkEntity(), values),

      save: async (link: ExecutionObservationLinkEntity) => {
        links.set(link.observationId, link);

        return link;
      },
    };

    const meetingsRepository = {
      findOne: async () => meeting,
    };

    const membersRepository = {
      findOne: async (options: {
        where?: {
          id?: string;
          workspaceId?: string;
        };
      }) => {
        if (
          options.where?.id === ownerId &&
          options.where?.workspaceId === workspaceId
        ) {
          return owner;
        }

        return null;
      },
    };

    const itemsRepository = {
      findOne: async (options: {
        where?: {
          id?: string;
        };
      }) => {
        if (state.sprintItem && options.where?.id === state.sprintItem.id) {
          return state.sprintItem;
        }

        return null;
      },

      create: (values: Partial<SprintItemEntity>) =>
        Object.assign(new SprintItemEntity(), values),

      save: async (item: SprintItemEntity) => {
        state.sprintItem = item;

        return item;
      },
    };

    const sprintsRepository = {
      findOne: async () => sprint,
    };

    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === ExecutionObservationLinkEntity) {
          return linksRepository;
        }

        if (entity === MeetingEntity) {
          return meetingsRepository;
        }

        if (entity === WorkspaceMemberEntity) {
          return membersRepository;
        }

        if (entity === SprintItemEntity) {
          return itemsRepository;
        }

        if (entity === SprintEntity) {
          return sprintsRepository;
        }

        throw new Error('Unexpected repository access');
      },
    } as unknown as EntityManager;

    const dataSource = {
      transaction: async (work: (manager: EntityManager) => Promise<unknown>) =>
        work(manager),
    } as unknown as DataSource;

    const execution = new ExecutionService(dataSource, jiraSyncOutbox);

    const interventionService = new InterventionService();

    const interventionPublisher = new InterventionPublisher({
      client: redis,
    } as RedisService);

    const dueAt = new Date('2026-09-25T23:59:59.999Z');

    // --------------------------------------------------
    // 1. Initial ownerless commitment.
    //
    // This represents:
    //
    // "Prepare the deployment checklist."
    //
    // The commitment is valid, but no owner is known yet.
    // --------------------------------------------------

    const firstObservation: SemanticObservation = {
      id: firstObservationId,

      kind: 'commitment',

      evidenceEventId: firstEvidenceId,

      evidenceText: 'Prepare the deployment checklist.',

      summary: 'Prepare the deployment checklist',

      dueText: 'Friday',

      explicit: true,

      confidence: 0.95,
    };

    const firstItem = await execution.applyCommitment({
      meetingId,

      observationId: firstObservation.id,

      evidenceEventId: firstObservation.evidenceEventId,

      summary: firstObservation.summary,

      ownerWorkspaceMemberId: null,

      dueAt,
    });

    expect(firstItem.ownerWorkspaceMemberId).toBeNull();

    expect(firstItem.dueAt).toEqual(dueAt);

    const firstSprintItemId = firstItem.id;

    expect(state.sprintItem).toBe(firstItem);

    // --------------------------------------------------
    // 2. Evaluate execution state.
    //
    // Owner is missing, therefore Lumos should create
    // exactly one missing_owner intervention.
    // --------------------------------------------------

    const interventions = interventionService.evaluate({
      meetingId,

      sprintItemId: firstItem.id,

      observation: firstObservation,

      ownerWorkspaceMemberId: firstItem.ownerWorkspaceMemberId,

      dueAt: firstItem.dueAt,

      createdAt: new Date('2026-09-24T01:00:00.000Z'),
    });

    expect(interventions).toHaveLength(1);

    const firstIntervention = interventions[0];

    expect(firstIntervention).toBeDefined();

    if (!firstIntervention) {
      throw new Error('Expected missing-owner intervention');
    }

    expect(firstIntervention.reason).toBe('missing_owner');

    expect(firstIntervention.message).toBe("Got it — who's taking this one?");

    const gapId = interventionGapId(firstItem.id, 'missing_owner');

    expect(firstIntervention.gapId).toBe(gapId);

    const stateKey =
      `lumos:meeting:{${meetingId}}:` + `intervention-gap:${gapId}`;

    const streamKey = `lumos:meeting:{${meetingId}}:` + 'interventions';

    const firstDedupeKey =
      `lumos:meeting:{${meetingId}}:` +
      `intervention:${firstIntervention.id}:stream-id`;

    // Ensure this test starts with isolated Redis state.
    await redis.del(stateKey, streamKey, firstDedupeKey);

    const publishResult =
      await interventionPublisher.publish(firstIntervention);

    expect(publishResult.status).toBe('published');

    const openGapState = await redis.hgetall(stateKey);

    expect(openGapState.gap_id).toBe(gapId);

    expect(openGapState.reason).toBe('missing_owner');

    expect(openGapState.sprint_item_id).toBe(firstItem.id);

    expect(openGapState.asked_count).toBe('1');

    expect(openGapState.resolved_at_ms).toBeUndefined();

    expect(openGapState.resolved_observation_id).toBeUndefined();

    // --------------------------------------------------
    // 3. Another participant answers:
    //
    // "I'll own it."
    //
    // The Go semantic layer has already turned that into
    // a refinement that supersedes the original
    // ownerless commitment.
    // --------------------------------------------------

    const secondObservation: SemanticObservation = {
      id: secondObservationId,

      kind: 'commitment',

      evidenceEventId: secondEvidenceId,

      supportingEvidenceEventIds: [firstEvidenceId, secondEvidenceId],

      evidenceText: ['Prepare the deployment checklist.', "I'll own it."].join(
        '\n',
      ),

      summary: 'Prepare the deployment checklist',

      owner: `member:${ownerId}`,

      dueText: 'Friday',

      supersedesObservationId: firstObservationId,

      explicit: true,

      confidence: 0.95,
    };

    const refinedItem = await execution.applyCommitment({
      meetingId,

      observationId: secondObservation.id,

      evidenceEventId: secondObservation.evidenceEventId,

      summary: secondObservation.summary,

      ownerWorkspaceMemberId: ownerId,

      // ExecutionService preserves the old due date
      // when a refinement does not provide a new one.
      dueAt: null,

      supersedesObservationId: secondObservation.supersedesObservationId,
    });

    // --------------------------------------------------
    // 4. The refined commitment MUST mutate the SAME
    // SprintItem instead of creating another task.
    // --------------------------------------------------

    expect(refinedItem.id).toBe(firstSprintItemId);

    expect(state.sprintItem).toBe(refinedItem);

    expect(refinedItem.ownerWorkspaceMemberId).toBe(ownerId);

    expect(refinedItem.dueAt).toEqual(dueAt);

    expect(links.size).toBe(2);

    const firstLink = links.get(firstObservationId);

    const secondLink = links.get(secondObservationId);

    expect(firstLink).toBeDefined();

    expect(secondLink).toBeDefined();

    expect(firstLink?.sprintItemId).toBe(firstSprintItemId);

    expect(secondLink?.sprintItemId).toBe(firstSprintItemId);

    // --------------------------------------------------
    // 5. This mirrors SemanticExecutionWorker behavior.
    //
    // Once the resulting SprintItem has an owner,
    // missing_owner must be resolved.
    // --------------------------------------------------

    const resolvedAt = new Date('2026-09-24T01:01:00.000Z');

    const resolved = await interventionPublisher.resolveGap(
      meetingId,
      refinedItem.id,
      'missing_owner',
      secondObservation.id,
      resolvedAt,
    );

    expect(resolved).toBe(true);

    const resolvedGapState = await redis.hgetall(stateKey);

    expect(resolvedGapState.gap_id).toBe(gapId);

    expect(resolvedGapState.reason).toBe('missing_owner');

    expect(resolvedGapState.sprint_item_id).toBe(firstSprintItemId);

    expect(resolvedGapState.resolved_at_ms).toBe(String(resolvedAt.getTime()));

    expect(resolvedGapState.resolved_observation_id).toBe(secondObservation.id);

    // --------------------------------------------------
    // 6. Re-evaluate after refinement.
    //
    // Owner and due date are now both present.
    // No new intervention should be requested.
    // --------------------------------------------------

    const afterAnswer = interventionService.evaluate({
      meetingId,

      sprintItemId: refinedItem.id,

      observation: secondObservation,

      ownerWorkspaceMemberId: refinedItem.ownerWorkspaceMemberId,

      dueAt: refinedItem.dueAt,

      createdAt: resolvedAt,
    });

    expect(afterAnswer).toEqual([]);

    // --------------------------------------------------
    // 7. A stale/late request for the already resolved
    // missing_owner gap must NOT reopen it.
    // --------------------------------------------------

    const staleObservation: SemanticObservation = {
      ...secondObservation,

      id: 'observation-stale-ownerless',

      owner: undefined,

      supersedesObservationId: secondObservation.id,
    };

    const staleInterventions = interventionService.evaluate({
      meetingId,

      sprintItemId: refinedItem.id,

      observation: staleObservation,

      ownerWorkspaceMemberId: null,

      dueAt: refinedItem.dueAt,

      createdAt: new Date('2026-09-24T01:02:00.000Z'),
    });

    expect(staleInterventions).toHaveLength(1);

    const staleIntervention = staleInterventions[0];

    expect(staleIntervention).toBeDefined();

    if (!staleIntervention) {
      throw new Error('Expected stale missing-owner intervention');
    }

    expect(staleIntervention.gapId).toBe(gapId);

    const staleDedupeKey =
      `lumos:meeting:{${meetingId}}:` +
      `intervention:${staleIntervention.id}:stream-id`;

    const stalePublishResult =
      await interventionPublisher.publish(staleIntervention);

    expect(stalePublishResult.status).toBe('resolved');

    // Verify the resolution state was not changed
    // or reopened by the stale publish.
    const finalGapState = await redis.hgetall(stateKey);

    expect(finalGapState.resolved_at_ms).toBe(String(resolvedAt.getTime()));

    expect(finalGapState.resolved_observation_id).toBe(secondObservation.id);

    // --------------------------------------------------
    // Cleanup.
    // --------------------------------------------------

    await redis.del(stateKey, streamKey, firstDedupeKey, staleDedupeKey);
  });
});
