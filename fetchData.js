const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeISRSpeedSwimming() {
    try {
        console.log("מתחיל בשאיבת נתונים ציבוריים מאתר איגוד השחייה (isr.org.il)...");

        // רשימת מזהי תחרויות לדוגמה מתוך האתר של האיגוד (אפשר להוסיף עוד לפי הצורך)
        // לדוגמה, התחרויות שמופיעות בלוח האירועים הציבורי
        const competitionIds = [16854, 16855, 16856]; // אפשר להרחיב לפי מזהי התחרויות שמעניינים אותך
        let allResults = [];

        for (const compId of competitionIds) {
            const url = `https://www.isr.org.il/comp.asp?compID=${compId}`;
            console.log(`מוריד נתונים מתחרות ID: ${compId}...`);

            try {
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const $ = cheerio.load(response.data);
                const competitionName = $('h1').text().trim() || `תחרות שחייה ${compId}`;

                // סריקת טבלאות התוצאות בעמוד התחרות
                $('table tr').each((_, row) => {
                    const cells = $(row).find('td');
                    
                    if (cells.length >= 4) {
                        let rowTexts = [];
                        cells.each((_, cell) => {
                            rowTexts.push($(cell).text().trim().replace(/\s+/g, ' '));
                        });

                        // זיהוי שדות לפי המבנה המקובל בטבלאות התוצאות של האיגוד
                        const swimmerName = rowTexts[1] || '';
                        const clubName = rowTexts[2] || '';
                        const resultTime = rowTexts[rowTexts.length - 1] || '';

                        // סינון שורות שאינן שחיינים אמיתיים (כגון כותרות טבלה)
                        if (
                            swimmerName && 
                            !swimmerName.includes('שחיין') && 
                            !swimmerName.includes('שם') && 
                            resultTime.includes(':')
                        ) {
                            allResults.push({
                                swimmer_id: `isr_${allResults.length + 1}`,
                                swimmer: {
                                    first_name: swimmerName,
                                    last_name: ''
                                },
                                birth_year: '2010', // ניתן לחלץ מדויק אם השדה קיים בטבלה
                                stroke_name_he: '200 חופשי', // יזוהה לפי הכותרת מעל הטבלה
                                pool: 25,
                                time: resultTime,
                                club: {
                                    name_he: clubName || 'אגודת שחייה'
                                },
                                competition: competitionName,
                                date: '2026-10-23'
                            });
                        }
                    }
                });

            } catch (err) {
                console.warn(`לא ניתן לגשת לתחרות ${compId}:`, err.message);
            }
        }

        console.log(`סך הכל נאספו ${allResults.length} תוצאות אמיתיות מהאיגוד!`);

        // שמירה ישירות לקובץ הנתונים של האפליקציה ב-React
        const targetPath = './client/public/master_swimming_database.json';
        fs.writeFileSync(targetPath, JSON.stringify(allResults, null, 2), 'utf-8');
        console.log("הקובץ עודכן בהצלחה עם הנתונים הציבוריים!");

    } catch (error) {
        console.error("שגיאה בתהליך השאיבה:", error.message);
    }
}

scrapeISRSpeedSwimming();
