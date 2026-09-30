import { describe, expect, it } from 'vitest';
import { resolveDueDate } from './resolve-due-date.js';

describe('deadline resolution', () => {
  const reference = new Date('2026-09-30T00:21:46Z');
  it.each([
    ['On Monday.', '2026-10-05'],
    ['By Tuesday.', '2026-10-06'],
    ['Wednesday works.', '2026-10-07'],
    ['Next Thursday.', '2026-10-08'],
    ['On Friday.', '2026-10-02'],
    ['On Saturday.', '2026-10-03'],
    ['By Sunday.', '2026-10-04'],
    ['tomorrow', '2026-10-01'],
    ['today', '2026-09-30'],
    ['by 2026-10-12', '2026-10-12'],
  ])('resolves %s from the stream event date', (text, date) => {
    expect(resolveDueDate(text, reference)?.toISOString()).toBe(
      date + 'T23:59:59.999Z',
    );
  });
  it('rejects invalid dates and ungrounded timing', () => {
    expect(resolveDueDate('2026-02-30', reference)).toBeNull();
    expect(resolveDueDate('once timing is agreed', reference)).toBeNull();
    expect(resolveDueDate(undefined, reference)).toBeNull();
  });
});
