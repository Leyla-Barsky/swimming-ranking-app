
const fs = require('fs');

const backupPath = './client/public/loglig_results_backup.json';
const currentPath = './client/public/loglig_results.json';

function loadResults(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`הקובץ לא נמצא: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!Array.isArray(data)) {
        throw new Error(`הקובץ אינו מכיל מערך: ${filePath}`);
    }

    return data;
}

function inspectDuplicates(results, label) {
    const groups = new Map();

    for (const result of results) {
        const key = result.result_id;

        if (!key) continue;

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(result);
    }

    const duplicateGroups = [...groups.entries()]
        .filter(([key, items]) => items.length > 1);

    const duplicateRows = duplicateGroups.reduce(
        (sum, [key, items]) => sum + items.length - 1,
        0
    );

    const conflictingGroups = duplicateGroups.filter(
        ([key, items]) => {
            const first = JSON.stringify(items[0]);

            return items.some(
                item => JSON.stringify(item) !== first
            );
        }
    );

    console.log(`\n========== ${label} ==========`);
    console.log(`מספר תוצאות בקובץ: ${results.length}`);
    console.log(`מזהי תוצאה ייחודיים: ${groups.size}`);
    console.log(`קבוצות כפולות: ${duplicateGroups.length}`);
    console.log(`רשומות עודפות בקבוצות כפולות: ${duplicateRows}`);
    console.log(`קבוצות עם פרטים שונים: ${conflictingGroups.length}`);

    console.log('\nדוגמאות לקבוצות כפולות:');

    duplicateGroups.slice(0, 5).forEach(([key, items], index) => {
        console.log(`\nדוגמה ${index + 1}:`);
        console.log(`מזהה: ${key}`);
        console.log(`מספר הופעות: ${items.length}`);

        items.forEach(item => {
            console.log({
                swimmer: item.swimmer?.full_name,
                birth_year: item.birth_year,
                discipline: item.discipline,
                category: item.category,
                competition: item.competition,
                date: item.competition_date,
                pool: item.pool_length,
                time: item.time,
                position: item.position,
                heat: item.heat,
                lane: item.lane
            });
        });
    });

    return {
        duplicateGroups: duplicateGroups.length,
        duplicateRows,
        conflictingGroups: conflictingGroups.length
    };
}

try {
    const backup = loadResults(backupPath);
    const current = loadResults(currentPath);

    const backupReport = inspectDuplicates(
        backup,
        'קובץ הגיבוי המקורי'
    );

    const currentReport = inspectDuplicates(
        current,
        'קובץ התוצאות הנוכחי'
    );

    console.log('\n========== סיכום ==========');
    console.log(
        `הפרש בין מספר התוצאות: ${backup.length - current.length}`
    );
    console.log(
        `כפילויות עודפות בגיבוי: ${backupReport.duplicateRows}`
    );
    console.log(
        `כפילויות עודפות בקובץ הנוכחי: ${currentReport.duplicateRows}`
    );

} catch (error) {
    console.error('שגיאה בבדיקה:', error.message);
}
