
const invalidNames = ['חופשי', 'גב', 'חזה', 'פרפר', 'מעורב'];

const isValidSwimmerName = (name) => {
  const cleanName = String(name || '').trim();

  return (
    cleanName !== '' &&
    !invalidNames.includes(cleanName) &&
    !/^\d/.test(cleanName)
  );
};

const getSwimmerName = (row) => {
  const possibleNames = [
    row.swimmer?.full_name,
    row.swimmer?.first_name,
    row.name
  ];

  return possibleNames.find(isValidSwimmerName) || 'שחיין לא ידוע';
};

const tests = [
  {
    description: 'שם מלא קיים',
    row: { swimmer: { full_name: 'נועה לוי', first_name: 'נועה' } },
    expected: 'נועה לוי'
  },
  {
    description: 'שם פרטי כשאין שם מלא',
    row: { swimmer: { first_name: 'נועה לוי' } },
    expected: 'נועה לוי'
  },
  {
    description: 'שם מלא עם רווחים בלבד',
    row: { swimmer: { full_name: '   ', first_name: 'נועה לוי' } },
    expected: 'נועה לוי'
  },
  {
    description: 'שם פרטי לא תקין, אבל יש שם תקין בשדה name',
    row: { swimmer: { first_name: 'גב' }, name: 'נועה לוי' },
    expected: 'נועה לוי'
  },
  {
    description: 'יש רק שם של משחה',
    row: { swimmer: { full_name: '50 חופשי' } },
    expected: 'שחיין לא ידוע'
  }
];

let passed = 0;

tests.forEach((test, index) => {
  const actual = getSwimmerName(test.row);
  const success = actual === test.expected;

  if (success) passed++;

  console.log(
    `${success ? 'עבר' : 'נכשל'} - בדיקה ${index + 1}: ${test.description}`
  );

  if (!success) {
    console.log('צפוי:', test.expected);
    console.log('התקבל:', actual);
  }
});

console.log(`\nסיכום: ${passed} מתוך ${tests.length} בדיקות עברו.`);
