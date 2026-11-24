
export function timeToSeconds(timeStr) {
  if (!timeStr || timeStr === '-' || timeStr === '00:00.00') {
    return 999999;
  }

  const parts = String(timeStr).split(':').map(Number);

  if (parts.some(part => Number.isNaN(part))) {
    return 999999;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] || 999999;
}

export function getBirthYears(swimmers) {
  const years = swimmers
    .map(item => String(item.birth_year || '').trim())
    .filter(year => Number(year) >= 1998 && Number(year) <= 2019);

  return [
    'הכל',
    ...[...new Set(years)].sort((a, b) => Number(a) - Number(b))
  ];
}

export function matchesBirthYear(item, yearFrom, yearTo) {
  const birthYear = parseInt(item.birth_year);

  const yearFromMatch =
    yearFrom === 'הכל' ||
    (!isNaN(birthYear) && birthYear >= parseInt(yearFrom));

  const yearToMatch =
    yearTo === 'הכל' ||
    (!isNaN(birthYear) && birthYear <= parseInt(yearTo));

  return yearFromMatch && yearToMatch;
}
