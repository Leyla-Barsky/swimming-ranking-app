const fs = require('fs');

if (fs.existsSync('association_competitions.json')) {
    const data = JSON.parse(fs.readFileSync('association_competitions.json', 'utf-8'));
    if (data.length > 0) {
        console.log("דוגמה לרשומה מתוך association_competitions.json:");
        console.log(JSON.stringify(data[0], null, 2));
    }
}
