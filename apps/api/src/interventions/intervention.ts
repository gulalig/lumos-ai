export type InterventionReason = 'missing_owner' | 'missing_due_date';

export type Intervention = {
  id: string;
  gapId: string;
  meetingId: string;
  sprintItemId: string;
  observationId: string;
  reason: InterventionReason;
  message: string;
  createdAt: Date;
};
