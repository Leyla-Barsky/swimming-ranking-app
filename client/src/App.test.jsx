
import { describe, expect, it } from 'vitest';
import { timeToSeconds, getBirthYears, matchesBirthYear } from './swimmingUtils.js';

describe('timeToSeconds', () => {
  it('converts minutes and seconds to seconds', () => {
    expect(timeToSeconds('1:23.45')).toBeCloseTo(83.45);
  });

  it('converts hours, minutes and seconds', () => {
    expect(timeToSeconds('01:02:03.45')).toBeCloseTo(3723.45);
  });

  it.each(['', null, undefined, '-', '00:00.00'])(
    'handles missing or empty time: %s',
    (time) => {
      expect(timeToSeconds(time)).toBe(999999);
    }
  );

  it('handles invalid time values', () => {
    expect(timeToSeconds('invalid')).toBe(999999);
  });
});

describe('getBirthYears', () => {
  it('returns unique years between 1998 and 2019 in ascending order', () => {
    const swimmers = [
      { birth_year: 2003 },
      { birth_year: 1997 },
      { birth_year: 1998 },
      { birth_year: 1999 },
      { birth_year: 2019 },
      { birth_year: 2020 },
      { birth_year: 2003 },
      { birth_year: null },
      { birth_year: ' 2001 ' }
    ];

    expect(getBirthYears(swimmers)).toEqual([
      'הכל', '1998', '1999', '2001', '2003', '2019'
    ]);
  });
});

describe('matchesBirthYear', () => {
  it('accepts a swimmer within the selected range', () => {
    expect(matchesBirthYear(
      { birth_year: 2000 }, '1998', '2003'
    )).toBe(true);
  });

  it('rejects a swimmer below the selected range', () => {
    expect(matchesBirthYear(
      { birth_year: 1997 }, '1998', 'הכל'
    )).toBe(false);
  });

  it('rejects a swimmer above the selected range', () => {
    expect(matchesBirthYear(
      { birth_year: 2020 }, 'הכל', '2019'
    )).toBe(false);
  });

  it('accepts all birth years when both filters are unrestricted', () => {
    expect(matchesBirthYear(
      { birth_year: null }, 'הכל', 'הכל'
    )).toBe(true);
  });

  it('rejects missing birth year when a range is selected', () => {
    expect(matchesBirthYear(
      { birth_year: null }, '1998', '2010'
    )).toBe(false);
  });
});
