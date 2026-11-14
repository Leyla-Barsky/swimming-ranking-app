
const fs = require('fs');
const path = require('path');

function mergeAllDataSources() {
    console.log('מתחיל ביצירת מאגר תוצאות השחייה...');

    const resultsPath = path.join(__dirname, 'client', 'public', 'loglig_results.json');
    const outputPath = path.join(__dirname, 'client', 'public', 'master_swimming_database.json');
    const backupPath = path.join(__dirname, 'client', 'public', 'master_swimming_database_backup.json');

    if (!fs.existsSync(resultsPath)) {
        console.error('שגיאה: הקובץ loglig_results.json לא נמצא.');
        return;
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

    if (!Array.isArray(results)) {
        console.error('שגיאה: מבנה קובץ התוצאות אינו תקין.');
        return;
    }

    // שומרים גיבוי של המאגר הקודם, אם קיים
    if (fs.existsSync(outputPath)) {
        fs.copyFileSync(outputPath, backupPath);
        console.log('נשמר גיבוי של המאגר הקודם.');
    }

    // שומרים רק רשומות שיש בהן שם שחיין וזמן תוצאה
    const validResults = results.filter(item =>
        item &&
        item.swimmer &&
        item.swimmer.first_name &&
        item.time &&
        item.time !== '-'
    );

    fs.writeFileSync(
        outputPath,
        JSON.stringify(validResults, null, 2),
        'utf8'
    );

    console.log(`נטענו ${results.length} רשומות.`);
    console.log(`נשמרו ${validResults.length} תוצאות תקינות.`);
    console.log(`נוצר המאגר: ${outputPath}`);
}

mergeAllDataSources();
c