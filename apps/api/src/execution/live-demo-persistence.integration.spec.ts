import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { Redis } from 'ioredis';
import { DataSource, type EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { UserEntity } from '../identity/entities/user.entity.js';
import { WorkspaceEntity } from '../identity/entities/workspace.entity.js';
import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';
import { MeetingEntity } from '../meetings/meeting.entity.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { MeetingsService } from '../meetings/meetings.service.js';
import { MeetingSnapshotService } from '../meetings/meeting-snapshot.service.js';
import { RedisService } from '../redis/redis.service.js';
import { SprintEntity } from '../sprints/entities/sprint.entity.js';
import { SprintItemEntity } from '../sprints/entities/sprint-item.entity.js';
import { InterventionPublisher } from '../interventions/intervention.publisher.js';
import { InterventionService } from '../interventions/intervention.service.js';
import { interventionGapId } from '../interventions/intervention-gap.js';
import {
  SemanticObservation,
  SEMANTIC_EVENT_TYPE,
  semanticStreamKey,
} from '../semantics/semantic-observation.js';
import { JiraIssueMappingEntity } from '../integrations/jira/entities/jira-issue-mapping.entity.js';
import { JiraSyncOutboxEntity } from '../integrations/jira/entities/jira-sync-outbox.entity.js';
import { JiraSyncOutboxRepository } from '../integrations/jira/jira-sync-outbox.repository.js';
import { JiraIssueMappingsRepository } from '../integrations/jira/jira-issue-mappings.repository.js';
import { JiraSyncService } from '../integrations/jira/jira-sync.service.js';
import { AtlassianApiService } from '../integrations/jira/atlassian-api.service.js';
import { AtlassianAccessTokenService } from '../integrations/jira/atlassian-access-token.service.js';
import { AtlassianConnectionsService } from '../integrations/jira/atlassian-connections.service.js';
import { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';
import { ExecutionService } from './execution.service.js';
import { SemanticExecutionWorker } from './semantic-execution.worker.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
dotenv.config({ path: resolve(process.cwd(), '.env'), quiet: true });

// Real PostgreSQL repositories and Redis streams, with only the external Jira
// API stubbed. Fixtures are invisible to running workers and rolled back.
describe.runIf(Boolean(process.env.DATABASE_URL))(
  'live demo persistence',
  () => {
    it('keeps one item, outbox row and Jira mapping through responsibility and deadline refinements, resolving the UI gap', async () => {
      const db = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        synchronize: false,
        entities: [
          UserEntity,
          WorkspaceEntity,
          WorkspaceMemberEntity,
          MeetingEntity,
          SprintEntity,
          SprintItemEntity,
          ExecutionObservationLinkEntity,
          JiraIssueMappingEntity,
          JiraSyncOutboxEntity,
        ],
      });
      const redis = new Redis(
        process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      );
      const meetingId = randomUUID();
      const workspaceId = randomUUID();
      const sprintId = randomUUID();
      const ownerId = randomUUID();
      const userId = randomUUID();
      await db.initialize();
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        const manager = runner.manager;
        await manager
          .getRepository(WorkspaceEntity)
          .save({
            id: workspaceId,
            name: 'Regression fixture',
            slug: workspaceId,
          });
        await manager
          .getRepository(UserEntity)
          .save({
            id: userId,
            email: userId + '@example.invalid',
            displayName: 'demo:maya',
          });
        await manager
          .getRepository(WorkspaceMemberEntity)
          .save({ id: ownerId, workspaceId, userId, role: 'member' });
        await manager
          .getRepository(SprintEntity)
          .save({
            id: sprintId,
            workspaceId,
            name: 'Regression',
            status: 'active',
          });
        const meeting = await manager
          .getRepository(MeetingEntity)
          .save({
            id: meetingId,
            workspaceId,
            roomName: meetingId,
            status: 'active',
          });
        const scoped = {
          manager,
          getRepository: manager.getRepository.bind(manager),
          transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
            manager.transaction(work),
        } as unknown as DataSource;
        const redisService = { client: redis } as RedisService;
        const publisher = new InterventionPublisher(redisService);
        const execution = new ExecutionService(
          scoped,
          new JiraSyncOutboxRepository(scoped),
        );
        const worker = new SemanticExecutionWorker(
          redisService,
          {} as MeetingsRepository,
          execution,
          new InterventionService(),
          publisher,
        );
        const process = (
          worker as unknown as { processMeeting(id: string): Promise<void> }
        ).processMeeting.bind(worker);
        const mappings = new JiraIssueMappingsRepository(
          manager.getRepository(JiraIssueMappingEntity),
        );
        const jiraApi = {
          findIssueByLumosSprintItemId: vi.fn().mockResolvedValue(null),
          getProjectIssueTypes: vi
            .fn()
            .mockResolvedValue([{ id: 'task', name: 'Task', subtask: false }]),
          createIssue: vi
            .fn()
            .mockResolvedValue({ id: 'jira-test-issue', key: 'TEST-1' }),
          updateIssue: vi.fn().mockResolvedValue(undefined),
        };
        const jira = new JiraSyncService(
          scoped,
          {
            requireByWorkspaceId: vi
              .fn()
              .mockResolvedValue({
                status: 'connected',
                cloudId: 'test-cloud',
                projectId: 'test-project',
                projectKey: 'TEST',
              }),
          } as unknown as AtlassianConnectionsService,
          {
            getValidAccessToken: vi.fn().mockResolvedValue('test-token'),
          } as unknown as AtlassianAccessTokenService,
          jiraApi as unknown as AtlassianApiService,
          mappings,
        );
        const first: SemanticObservation = {
          id: 'original-' + meetingId,
          kind: 'commitment',
          evidenceEventId: 'evidence-1',
          evidenceText: 'I can take care of the final review.',
          summary: 'Final review',
          owner: 'demo:maya',
          explicit: true,
          confidence: 0.99,
        };
        const append = async (observation: SemanticObservation) => {
          await redis.xadd(
            semanticStreamKey(meetingId),
            '*',
            'event_type',
            SEMANTIC_EVENT_TYPE,
            'event_id',
            observation.id,
            'payload',
            JSON.stringify(observation),
          );
          await process(meetingId);
        };
        await append(first);
        const item = await manager
          .getRepository(SprintItemEntity)
          .findOneByOrFail({ sprintId });
        const itemId = item.id;
        expect(item.dueAt).toBeNull();
        expect(item.ownerWorkspaceMemberId).toBe(ownerId);
        await jira.syncItem({ workspaceId, sprintItemId: itemId });
        const mappingBefore = await mappings.findBySprintItemId(itemId);
        const outboxBefore = await manager
          .getRepository(JiraSyncOutboxEntity)
          .findOneByOrFail({ sprintItemId: itemId });

        const restated: SemanticObservation = {
          ...first,
          id: 'restated-' + meetingId,
          evidenceEventId: 'evidence-2',
          evidenceText:
            first.evidenceText +
            '\nOnce we agree on the timing, I can take ownership of the final check.',
          summary: 'Final check',
          supersedesObservationId: first.id,
          supportingEvidenceEventIds: ['evidence-1', 'evidence-2'],
        };
        await append(restated);
        const gap = interventionGapId(itemId, 'missing_due_date');
        expect((await publisher.getGapState(meetingId, gap))?.askedCount).toBe(
          1,
        );
        const answer: SemanticObservation = {
          ...restated,
          id: 'deadline-' + meetingId,
          evidenceEventId: 'evidence-3',
          evidenceText: restated.evidenceText + '\nOn Monday.',
          dueText: 'On Monday',
          supersedesObservationId: restated.id,
          supportingEvidenceEventIds: ['evidence-2', 'evidence-3'],
        };
        await append(answer);
        await jira.syncItem({ workspaceId, sprintItemId: itemId });
        // Redelivery exercises the same durable link and never enqueues a new job.
        const dueBeforeReplay = (
          await manager
            .getRepository(SprintItemEntity)
            .findOneByOrFail({ id: itemId })
        ).dueAt;
        await append(answer);
        const items = await manager
          .getRepository(SprintItemEntity)
          .findBy({ sprintId });
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe(itemId);
        expect(items[0].ownerWorkspaceMemberId).toBe(ownerId);
        expect(items[0].dueAt).not.toBeNull();
        expect(items[0].dueAt).toEqual(dueBeforeReplay);
        const links = await manager
          .getRepository(ExecutionObservationLinkEntity)
          .findBy({ meetingId });
        expect(links).toHaveLength(3);
        expect(new Set(links.map((link) => link.sprintItemId))).toEqual(
          new Set([itemId]),
        );
        const jobs = await manager
          .getRepository(JiraSyncOutboxEntity)
          .findBy({ workspaceId });
        expect(jobs).toHaveLength(1);
        expect(jobs[0].id).toBe(outboxBefore.id);
        expect(jobs[0].revision).toBe(3);
        const mappingAfter = await mappings.findBySprintItemId(itemId);
        expect(mappingAfter?.id).toBe(mappingBefore?.id);
        expect(mappingAfter?.jiraIssueKey).toBe('TEST-1');
        expect(jiraApi.createIssue).toHaveBeenCalledOnce();
        expect(jiraApi.updateIssue).toHaveBeenCalledWith(
          'test-token',
          'test-cloud',
          'jira-test-issue',
          expect.objectContaining({ dueAt: items[0].dueAt }),
        );
        const resolvedGap = await publisher.getGapState(meetingId, gap);
        expect(resolvedGap?.resolvedAt).not.toBeNull();
        expect(resolvedGap?.resolvedObservationId).toBe(answer.id);
        expect(resolvedGap?.askedCount).toBe(1);
        const snapshots = new MeetingSnapshotService(redisService, {
          getByIdForWorkspace: vi.fn().mockResolvedValue(meeting),
        } as unknown as MeetingsService);
        const snapshot = await snapshots.getSnapshot(meetingId, workspaceId);
        expect(snapshot.commitments).toHaveLength(1);
        expect(snapshot.commitments[0]).toMatchObject({
          owner: 'demo:maya',
          dueText: 'On Monday',
        });
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
        await db.destroy();
        const keys = await redis.keys('lumos:meeting:{' + meetingId + '}:*');
        if (keys.length) await redis.del(...keys); // only this test's unique namespace
        await redis.quit();
      }
    }, 20_000);
  },
);
