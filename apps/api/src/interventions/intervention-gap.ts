import { createHash } from 'node:crypto';

import type { InterventionReason } from './intervention.js';

export function interventionGapId(
  sprintItemId: string,
  reason: InterventionReason,
): string {
  return createHash('sha256')
    .update(`${sprintItemId}:${reason}`)
    .digest('hex');
}
