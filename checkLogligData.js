
const fs = require('fs');

const data = JSON.parse(
    fs.readFileSync('./client/public/loglig_results.json', 'utf-8')
);

const uniqueIds = new Set(data.map(item => item.result_id));

console.log('סה"כ תוצאות:', data.length);
console.log('מזהי תוצאה כפולים:', data.length - uniqueIds.size);

console.log(
    'תוצאות ללא שנת לידה:',
    data.filter(item => !item.birth_year).length
);

console.log(
    'תוצאות ללא אגודה:',
    data.filter(item => !item.club?.name_he).length
);

console.log(
    'תוצאות ללא אורך בריכה:',
    data.filter(item => !item.pool_length).length
);

console.log('התפלגות אורכי בריכה:',
    data.reduce((acc, item) => {
        const key = item.pool_length || 'לא ידוע';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {})
);

console.log('התפלגות מגדר:',
    data.reduce((acc, item) => {
        acc[item.gender] = (acc[item.gender] || 0) + 1;
        return acc;
    }, {})
);
