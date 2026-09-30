// Dates are anchored to the durable semantic event, not the browser clock.
export function resolveDueDate(
  dueText: string | undefined,
  referenceTime: Date,
): Date | null {
  const normalized = dueText?.trim().toLowerCase();
  if (!normalized) return null;
  const iso = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    const due = new Date(iso[1] + 'T23:59:59.999Z');
    return Number.isFinite(due.getTime()) &&
      due.toISOString().slice(0, 10) === iso[1]
      ? due
      : null;
  }
  const due = new Date(referenceTime);
  let daysAhead: number;
  if (/\btomorrow\b/.test(normalized)) {
    daysAhead = 1;
  } else if (/\btoday\b/.test(normalized)) {
    daysAhead = 0;
  } else {
    const weekdays = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const match = normalized.match(
      /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
    );
    if (!match) return null;
    const target = weekdays.indexOf(match[1]);
    const current = due.getUTCDay();
    daysAhead = (target - current + 7) % 7;
    if (daysAhead === 0) daysAhead = 7;
    // "Next" means the weekday in the next Monday-through-Sunday week.
    if (/\bnext\b/.test(normalized)) {
      const currentInWeek = (current + 6) % 7;
      const targetInWeek = (target + 6) % 7;
      daysAhead = 7 - currentInWeek + targetInWeek;
    }
  }
  due.setUTCDate(due.getUTCDate() + daysAhead);
  due.setUTCHours(23, 59, 59, 999);
  return due;
}
