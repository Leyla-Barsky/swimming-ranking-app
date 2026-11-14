
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// המרת כתובת iframe לכתובת מלאה
function makeAbsoluteUrl(src, pageUrl) {
    try {
        return new URL(src, pageUrl).href;
    } catch {
        return null;
    }
}

// בדיקה האם זו כתובת של תקנון PDF
function isRegulationUrl(url) {
    if (!url) return false;

    return url.includes('ShowLeagueDoc');
}

// בדיקה האם זו כתובת Loglig של עמוד תחרות
function isCompetitionUrl(url) {
    if (!url) return false;

    try {
        const parsedUrl = new URL(url);

        return (
            parsedUrl.hostname.includes('loglig.com') &&
            !isRegulationUrl(url) &&
            !parsedUrl.pathname.toLowerCase().endsWith('.pdf')
        );
    } catch {
        return false;
    }
}

async function scrapeAssociationIframes() {
    try {
        if (!fs.existsSync('association_competitions.json')) {
            console.log('קובץ association_competitions.json לא נמצא.');
            return;
        }

        const competitions = JSON.parse(
            fs.readFileSync('association_competitions.json', 'utf-8')
        );

        console.log(
            `נטענו ${competitions.length} תחרויות. מחפש קישורי Loglig ותקנונים...`
        );

        const logligCompetitions = [];

        for (let i = 0; i < competitions.length; i++) {
            const comp = competitions[i];

            try {
                console.log(
                    `\n[${i + 1}/${competitions.length}] ${comp.title}`
                );

                const response = await axios.get(comp.url, {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 30000
                });

                const $ = cheerio.load(response.data);

                // שלב א': חיפוש קישור לתקנון
                const regulationLinks = [];

                $('a[href*="ShowLeagueDoc"]').each((index, element) => {
                    const href = $(element).attr('href');

                    const absoluteUrl = makeAbsoluteUrl(
                        href,
                        comp.url
                    );

                    if (
                        absoluteUrl &&
                        !regulationLinks.includes(absoluteUrl)
                    ) {
                        regulationLinks.push(absoluteUrl);
                    }
                });

                // שלב ב': חיפוש כל ה-iframes בעמוד
                const iframeLinks = [];

                $('iframe').each((index, element) => {
                    const src = $(element).attr('src');

                    if (!src) return;

                    const absoluteUrl = makeAbsoluteUrl(
                        src,
                        comp.url
                    );

                    if (
                        absoluteUrl &&
                        !iframeLinks.includes(absoluteUrl)
                    ) {
                        iframeLinks.push(absoluteUrl);
                    }
                });

                // שלב ג': הפרדה בין עמודי תחרות לבין תקנונים
                const competitionUrls = iframeLinks.filter(
                    isCompetitionUrl
                );

                const iframeRegulations = iframeLinks.filter(
                    isRegulationUrl
                );

                // אם לא נמצא קישור תקנון רגיל,
                // נבדוק אם התקנון נמצא בתוך iframe.
                const regulationUrl =
                    regulationLinks[0] ||
                    iframeRegulations[0] ||
                    null;

                // בוחרים רק iframe שהוא עמוד תחרות אמיתי
                const logligUrl = competitionUrls[0] || null;

                if (logligUrl) {
                    console.log('  נמצא עמוד תחרות Loglig.');
                } else {
                    console.log('  לא נמצא iframe של עמוד תחרות.');
                }

                if (regulationUrl) {
                    console.log('  נמצא קישור לתקנון.');
                } else {
                    console.log('  לא נמצא קישור לתקנון.');
                }

                // שומרים את התחרות גם אם נמצא רק תקנון.
                // כך לא נאבד מידע על תחרויות שעדיין אין להן תוצאות.
                if (logligUrl || regulationUrl) {
                    logligCompetitions.push({
                        ...comp,
                        associationUrl: comp.url,
                        logligUrl: competitionUrls[0] || null,
                        regulationUrl: regulationLinks[0] || iframeRegulations[0] || null,
                        source: 'Loglig_Iframe'
                    });
                }

            } catch (err) {
                console.log(
                    `  שגיאה בקריאת התחרות: ${err.message}`
                );
            }
        }

        console.log('\n================================');
        console.log('סריקת קישורי התחרויות הסתיימה!');
        console.log(
            `נמצאו ${logligCompetitions.length} תחרויות עם קישור Loglig או תקנון.`
        );

        const competitionsWithResults = logligCompetitions.filter(
            comp => comp.logligUrl
        ).length;

        const competitionsWithRegulations = logligCompetitions.filter(
            comp => comp.regulationUrl
        ).length;

        console.log(
            `עמודי תחרות: ${competitionsWithResults}`
        );

        console.log(
            `תקנונים: ${competitionsWithRegulations}`
        );

        // שמירת הקישורים לקובץ
        fs.writeFileSync(
            'loglig_competitions.json',
            JSON.stringify(logligCompetitions, null, 2),
            'utf-8'
        );

        console.log(
            'הקישורים נשמרו בהצלחה בקובץ loglig_competitions.json!'
        );
        console.log('================================');

    } catch (error) {
        console.error('שגיאה בסריקה:', error.message);
    }
}

scrapeAssociationIframes();
