import {
  applyDate,
  applyEndTimeOfDay,
  applyTimeOfDay,
  describeShiftSpan,
  shiftEndWithStart,
} from '../shiftTimes';

// Local-time constructor: (y, monthIndex, d, h, m)
const at = (y: number, mo: number, d: number, h: number, m = 0) =>
  new Date(y, mo, d, h, m, 0, 0);
const clock = (h: number, m = 0) => at(2000, 0, 1, h, m);

describe('applyEndTimeOfDay', () => {
  it('rolls an end time before the start into the next day', () => {
    const start = at(2026, 8, 25, 18);
    expect(applyEndTimeOfDay(start, clock(1))).toEqual(at(2026, 8, 26, 1));
  });

  it('keeps a same-day end on the start date', () => {
    const start = at(2026, 8, 25, 18);
    expect(applyEndTimeOfDay(start, clock(23))).toEqual(at(2026, 8, 25, 23));
  });

  it('treats an end equal to the start as a 24h shift', () => {
    const start = at(2026, 8, 25, 18);
    expect(applyEndTimeOfDay(start, clock(18))).toEqual(at(2026, 8, 26, 18));
  });

  it('anchors on the start, not a stale end date', () => {
    // End was 26th 02:00; picking 23:00 must give the 25th, not a 29h shift.
    const start = at(2026, 8, 25, 18);
    expect(applyEndTimeOfDay(start, clock(23))).toEqual(at(2026, 8, 25, 23));
  });

  it('crosses a year boundary', () => {
    const start = at(2026, 11, 31, 22);
    expect(applyEndTimeOfDay(start, clock(6))).toEqual(at(2027, 0, 1, 6));
  });

  it('keeps wall-clock time across the October DST change', () => {
    // 24–25 Oct 2026 is the UK clocks-back night.
    const start = at(2026, 9, 24, 20);
    const end = applyEndTimeOfDay(start, clock(4));
    expect(end.getDate()).toBe(25);
    expect(end.getHours()).toBe(4);
  });

  it('keeps picked minutes and zeroes seconds', () => {
    const start = at(2026, 8, 25, 18);
    expect(applyEndTimeOfDay(start, clock(1, 30))).toEqual(
      at(2026, 8, 26, 1, 30),
    );
  });
});

describe('start changes', () => {
  it('moves the end with the start date, preserving length', () => {
    const oldStart = at(2026, 8, 25, 18);
    const end = at(2026, 8, 26, 1);
    const newStart = applyDate(oldStart, at(2026, 8, 26, 0));
    expect(newStart).toEqual(at(2026, 8, 26, 18));
    expect(shiftEndWithStart(oldStart, newStart, end)).toEqual(
      at(2026, 8, 27, 1),
    );
  });

  it('moves the end with the start time', () => {
    const oldStart = at(2026, 8, 25, 18);
    const end = at(2026, 8, 26, 2);
    const newStart = applyTimeOfDay(oldStart, clock(20));
    expect(shiftEndWithStart(oldStart, newStart, end)).toEqual(
      at(2026, 8, 26, 4),
    );
  });
});

describe('describeShiftSpan', () => {
  it('labels an overnight shift', () => {
    expect(describeShiftSpan(at(2026, 8, 25, 18), at(2026, 8, 26, 1))).toBe(
      '7h · overnight',
    );
  });

  it('shows minutes on a same-day shift', () => {
    expect(
      describeShiftSpan(at(2026, 8, 25, 9), at(2026, 8, 25, 17, 30)),
    ).toBe('8h 30m');
  });

  it('is empty for an invalid range', () => {
    expect(describeShiftSpan(at(2026, 8, 25, 18), at(2026, 8, 25, 1))).toBe('');
  });
});
