import { z } from 'zod';

export const SEMANTIC_EVENT_TYPE =
  'semantic.observation.v1';

export const semanticObservationSchema =
  z.object({
    id: z.string().min(1),

    kind: z.enum([
      'unknown',
      'proposal',
      'decision',
      'commitment',
      'question',
    ]),

    evidenceEventId:
      z.string().min(1),

    supportingEvidenceEventIds:
      z.array(
        z.string().min(1),
      ).optional(),

    evidenceText:
      z.string(),

    summary:
      z.string().min(1),

    owner:
      z.string().optional(),

    dueText:
      z.string().optional(),

    supersedesObservationId:
      z.string()
        .min(1)
        .optional(),

    explicit:
      z.boolean(),

    confidence:
      z.number()
        .min(0)
        .max(1),
  });

export type SemanticObservation =
  z.infer<
    typeof semanticObservationSchema
  >;

export function semanticStreamKey(
  meetingId: string,
): string {
  return (
    `lumos:meeting:{${meetingId}}:` +
    'semantics'
  );
}

export function redisFieldsToRecord(
  fields: string[],
): Record<string, string> {
  const result:
    Record<string, string> = {};

  for (
    let index = 0;
    index < fields.length;
    index += 2
  ) {
    const key =
      fields[index];

    const value =
      fields[index + 1];

    if (
      key === undefined ||
      value === undefined
    ) {
      continue;
    }

    result[key] = value;
  }

  return result;
}
