import type { SemanticObservation } from '../semantics/semantic-observation.js';

import { InterventionService } from './intervention.service.js';

describe('InterventionService', () => {
  let service: InterventionService;

  beforeEach(() => {
    service = new InterventionService();
  });

  function observation(
    overrides: Partial<SemanticObservation> = {},
  ): SemanticObservation {
    return {
      id: 'observation-1',
      kind: 'commitment',
      evidenceEventId: 'evidence-1',
      evidenceText: 'I will deliver the API.',
      summary: 'Deliver the API',
      explicit: true,
      confidence: 1,
      ...overrides,
    };
  }

  it('asks for owner first when owner is missing', () => {
    const result = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation(),
      ownerWorkspaceMemberId: null,
      dueAt: new Date('2026-09-25T23:59:59.999Z'),
    });

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observationId: 'observation-1',
      reason: 'missing_owner',
      message: 'Who owns this commitment?',
    });
  });

  it('asks for due date when owner exists but due date is missing', () => {
    const result = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        owner: 'member:33333333-3333-4333-8333-333333333333',
      }),
      ownerWorkspaceMemberId: '33333333-3333-4333-8333-333333333333',
      dueAt: null,
    });

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observationId: 'observation-1',
      reason: 'missing_due_date',
      message: 'When is this commitment due?',
    });
  });

  it('does not intervene when owner and due date both exist', () => {
    const result = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        owner: 'member:33333333-3333-4333-8333-333333333333',
        dueText: 'Friday',
      }),
      ownerWorkspaceMemberId: '33333333-3333-4333-8333-333333333333',
      dueAt: new Date('2026-09-25T23:59:59.999Z'),
    });

    expect(result).toEqual([]);
  });

  it('ignores non-commitment observations', () => {
    const result = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        kind: 'decision',
      }),
      ownerWorkspaceMemberId: null,
      dueAt: null,
    });

    expect(result).toEqual([]);
  });

  it('treats a non-stable semantic owner as missing owner', () => {
    const result = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        owner: 'Ali',
        dueText: 'Friday',
      }),
      ownerWorkspaceMemberId: null,
      dueAt: new Date('2026-09-25T23:59:59.999Z'),
    });

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      reason: 'missing_owner',
      message: 'Who owns this commitment?',
    });
  });

  it('treats an unresolvable due date as missing due date', () => {
    const result = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        owner: 'member:33333333-3333-4333-8333-333333333333',
        dueText: 'sometime soon',
      }),
      ownerWorkspaceMemberId: '33333333-3333-4333-8333-333333333333',
      dueAt: null,
    });

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      reason: 'missing_due_date',
      message: 'When is this commitment due?',
    });
  });

  it('keeps the same gap id across observations for the same sprint item and reason', () => {
    const first = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        id: 'observation-1',
      }),
      ownerWorkspaceMemberId: null,
      dueAt: null,
    });

    const second = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        id: 'observation-2',
      }),
      ownerWorkspaceMemberId: null,
      dueAt: null,
    });

    expect(
      first[0].gapId,
    ).toBe(
      second[0].gapId,
    );
  });

  it('uses different request ids for different observations of the same gap', () => {
    const first = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        id: 'observation-1',
      }),
      ownerWorkspaceMemberId: null,
      dueAt: null,
    });

    const second = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation({
        id: 'observation-2',
      }),
      ownerWorkspaceMemberId: null,
      dueAt: null,
    });

    expect(
      first[0].id,
    ).not.toBe(
      second[0].id,
    );
  });

  it('produces different intervention ids for different gap reasons', () => {
    const missingOwner = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation(),
      ownerWorkspaceMemberId: null,
      dueAt: null,
    });

    const missingDueDate = service.evaluate({
      meetingId: 'meeting-1',
      sprintItemId: 'sprint-item-1',
      observation: observation(),
      ownerWorkspaceMemberId: '33333333-3333-4333-8333-333333333333',
      dueAt: null,
    });

    expect(
      missingOwner[0].id,
    ).not.toBe(
      missingDueDate[0].id,
    );
  });
});
