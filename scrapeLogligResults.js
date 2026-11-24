
const { chromium } = require('playwright');
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --------------------------------------------------
// הגדרות קבצים
// --------------------------------------------------

const COMPETITIONS_PATH = './loglig_competitions.json';
const RESULTS_PATH = './client/public/loglig_results.json';
const METADATA_PATH = './client/public/loglig_competition_metadata.json';

// --------------------------------------------------
// פונקציות תאריך
// --------------------------------------------------

function convertDate(dateText) {
    if (!dateText) return null;

    const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);

    if (!match) return null;

    return `${match[3]}-${match[2]}-${match[1]}`;
}

function extractDateText(text) {
    if (!text) return null;

    const israelDate = text.match(/\d{2}\/\d{2}\/\d{4}/);

    if (israelDate) return israelDate[0];

    const isoDate = text.match(/\d{4}-\d{2}-\d{2}/);

    if (isoDate) return isoDate[0];

    return null;
}

function getMonthFromDate(dateText) {
    if (!dateText) return null;

    const israelDate = dateText.match(
        /(\d{2})\/(\d{2})\/(\d{4})/
    );

    if (israelDate) {
        return Number(israelDate[2]);
    }

    const isoDate = dateText.match(
        /(\d{4})-(\d{2})-(\d{2})/
    );

    if (isoDate) {
        return Number(isoDate[2]);
    }

    return null;
}

// --------------------------------------------------
// זיהוי אורך בריכה
// --------------------------------------------------

function detectPoolLength(text) {
    if (!text) return null;

    const cleanText = text
        .replace(/\s+/g, '')
        .replace(/[\u200e\u200f\u202a-\u202e]/g, '');

    const is25Meters = /25(?:מטר|מ['׳״"]?)/.test(cleanText);
    const is50Meters = /50(?:מטר|מ['׳״"]?)/.test(cleanText);

    const isShortPool = /בריכ[הת]?קצרה/.test(cleanText);
    const isLongPool = /בריכ[הת]?ארוכה/.test(cleanText);

    const has25 = is25Meters || isShortPool;
    const has50 = is50Meters || isLongPool;

    if (has25 && has50) return null;

    if (has25) return '25';
    if (has50) return '50';

    return null;
}

function getPoolLengthFromRules({
    regulationText,
    competitionTitle,
    competitionPageText,
    dateText
}) {
    const regulationPoolLength = detectPoolLength(regulationText);

    if (regulationPoolLength) {
        return {
            poolLength: regulationPoolLength,
            reason: 'זוהה בתקנון'
        };
    }

    const allCompetitionText = [
        competitionTitle || '',
        competitionPageText || '',
        regulationText || ''
    ].join(' ');

    const isWingate = allCompetitionText.includes('וינגייט');
    const month = getMonthFromDate(dateText);

    if (isWingate && month !== null && month >= 3 && month <= 8) {
        return {
            poolLength: '50',
            reason: 'וינגייט, מרץ עד אוגוסט'
        };
    }

    return {
        poolLength: '25',
        reason: 'ברירת מחדל לפי כללי הבריכות'
    };
}

// --------------------------------------------------
// פונקציות תקנון
// --------------------------------------------------

function isRegulationUrl(url) {
    if (!url) return false;

    return (
        url.includes('ShowLeagueDoc') ||
        /\.pdf(?:$|\?)/i.test(url)
    );
}

async function readRegulationPdf(pdfUrl, request) {
    if (!pdfUrl) return '';

    let parser;

    try {
        console.log('  מוריד תקנון...');

        const response = await request.get(pdfUrl, {
            timeout: 30000
        });

        if (!response.ok()) {
            throw new Error(
                `הורדת PDF נכשלה: ${response.status()}`
            );
        }

        const buffer = await response.body();

        parser = new PDFParse({
            data: buffer
        });

        const result = await parser.getText();

        console.log('  התקנון נקרא בהצלחה.');

        return result.text || '';

    } catch (error) {
        console.log(
            `  לא ניתן לקרוא את התקנון: ${error.message}`
        );

        return '';

    } finally {
        if (parser) {
            await parser.destroy();
        }
    }
}

// --------------------------------------------------
// פונקציות זיהוי ושמות
// --------------------------------------------------

function getGender(category) {
    if (!category) return 'לא ידוע';

    if (
        category.includes('בנות') ||
        category.includes('נשים')
    ) {
        return 'בנות';
    }

    if (
        category.includes('בנים') ||
        category.includes('גברים')
    ) {
        return 'בנים';
    }

    return 'לא ידוע';
}

function createSwimmerId(name, birthYear) {
    return crypto
        .createHash('sha1')
        .update(`${name}|${birthYear || ''}`)
        .digest('hex');
}

function createResultId(eventUrl, name, birthYear, time) {
    return crypto
        .createHash('sha1')
        .update(`${eventUrl}|${name}|${time}`)
        .digest('hex');
}

// --------------------------------------------------
// טעינת תוצאות קיימות
// --------------------------------------------------

function loadExistingResults() {
    if (!fs.existsSync(RESULTS_PATH)) {
        console.log('לא נמצא קובץ תוצאות קודם. ייווצר קובץ חדש.');
        return [];
    }

    try {
        const data = JSON.parse(
            fs.readFileSync(RESULTS_PATH, 'utf-8')
        );

        if (!Array.isArray(data)) {
            throw new Error('מבנה קובץ התוצאות אינו מערך.');
        }

        console.log(
            `נטענו ${data.length} תוצאות קיימות.`
        );

        return data;

    } catch (error) {
        throw new Error(
            `לא ניתן לקרוא את קובץ התוצאות הקיים: ${error.message}`
        );
    }
}
function safeWriteJson(filePath, data) {
    const tempPath = `${filePath}.tmp`;

    try {
        fs.writeFileSync(
            tempPath,
            JSON.stringify(data, null, 2),
            'utf-8'
        );

        const verifiedData = JSON.parse(
            fs.readFileSync(tempPath, 'utf-8')
        );

        if (!Array.isArray(verifiedData)) {
            throw new Error('קובץ זמני אינו מערך תקין');
        }

        fs.renameSync(tempPath, filePath);

        console.log(`הקובץ נשמר בהצלחה: ${filePath}`);

    } catch (error) {
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        throw error;
    }
}
// --------------------------------------------------
// הסורק הראשי
// --------------------------------------------------

async function scrapeLogligResults() {
    let browser;

    try {
        if (!fs.existsSync(COMPETITIONS_PATH)) {
            console.log('קובץ loglig_competitions.json לא נמצא.');
            return;
        }

        const competitions = JSON.parse(
            fs.readFileSync(COMPETITIONS_PATH, 'utf-8')
        );

        const existingResults = loadExistingResults();

const resultsMap = new Map();

existingResults.forEach((result, index) => {
    const name =
        result.swimmer?.full_name ||
        result.swimmer?.first_name ||
        '';

    const key = result.event_url && name && result.time
        ? createResultId(
            result.event_url,
            name,
            result.birth_year,
            result.time
        )
        : result.result_id || `existing_${index}`;

    const previous = resultsMap.get(key);

    const mergedResult = {
        ...(previous || {}),
        ...result,
        result_id: key,
        birth_year:
            result.birth_year ||
            previous?.birth_year ||
            null
    };

    resultsMap.set(key, mergedResult);
});

        const competitionMetadata = [];
        let scanHadErrors = false;

        browser = await chromium.launch({
            headless: true
        });

        const page = await browser.newPage();

        for (let i = 0; i < competitions.length; i++) {
            const comp = competitions[i];

            const compTitle = comp.title || 'תחרות Loglig';

            console.log(
                `\n[${i + 1}/${competitions.length}] סורק: ${compTitle}`
            );

            try {
                // שלב א': זיהוי קישורי התחרות והתקנון

                let logligUrl = comp.logligUrl || null;
                let regulationUrl = comp.regulationUrl || null;

                if (isRegulationUrl(logligUrl)) {
                    if (!regulationUrl) {
                        regulationUrl = logligUrl;
                    }

                    logligUrl = null;
                }

                let competitionPageText = '';
                let regulationText = '';

                // שלב ב': קריאת התקנון

                if (regulationUrl) {
                    console.log('  נמצא קישור לתקנון בקובץ התחרויות.');

                    regulationText = await readRegulationPdf(
                        regulationUrl,
                        page.request
                    );
                }

                // שלב ג': פתיחת עמוד התחרות

                let events = [];

                if (logligUrl) {
                    try {
                        await page.goto(logligUrl, {
                            waitUntil: 'domcontentloaded',
                            timeout: 30000
                        });

                        competitionPageText = await page
                            .locator('body')
                            .innerText()
                            .catch(() => '');

                        if (!regulationText) {
                            const regulationLinks = await page
                                .locator('a[href*="ShowLeagueDoc"]')
                                .evaluateAll(links =>
                                    links.map(link => link.href)
                                );

                            if (regulationLinks.length > 0) {
                                regulationUrl = regulationLinks[0];

                                console.log(
                                    '  נמצא קישור לתקנון בעמוד התחרות.'
                                );

                                regulationText = await readRegulationPdf(
                                    regulationUrl,
                                    page.request
                                );
                            }
                        }

                        // שלב ד': איתור המשחים

                        events = await page.evaluate(() => {
                            const links = Array.from(
                                document.querySelectorAll('a.resultsModal')
                            );

                            return links.map(link => {
                                const row = link.closest('tr');

                                if (!row) return null;

                                const cells = Array.from(
                                    row.querySelectorAll('td')
                                );

                                return {
                                    resultsUrl: link.getAttribute('href'),

                                    discipline:
                                        cells[1]?.innerText.trim() || '',

                                    category:
                                        cells[2]?.innerText.trim() || '',

                                    dateText:
                                        cells[4]?.innerText.trim() || ''
                                };
                            }).filter(event =>
                                event &&
                                event.resultsUrl &&
                                event.discipline
                            );
                        });

                    } catch (pageError) {
                        scanHadErrors = true;

                        console.log(
                            `  לא ניתן לפתוח את עמוד התחרות: ${pageError.message}`
                        );
                    }

                } else {
                    console.log(
                        '  אין עמוד תוצאות. התחרות תישמר במידע התחרויות.'
                    );
                }

                // שלב ה': שמירת מידע על התחרות

                const competitionDateText =
                    extractDateText(compTitle) ||
                    comp.date ||
                    comp.competition_date ||
                    null;

                const competitionPoolInfo = getPoolLengthFromRules({
                    regulationText,
                    competitionTitle: compTitle,
                    competitionPageText,
                    dateText: competitionDateText
                });

                let competitionStatus;

                if (!logligUrl) {
                    competitionStatus = 'no_results_page';
                } else if (events.length === 0) {
                    competitionStatus = 'no_results_yet';
                } else {
                    competitionStatus = 'has_results_page';
                }

                competitionMetadata.push({
                    ...comp,

                    associationUrl:
                        comp.associationUrl || comp.url || null,

                    logligUrl,
                    regulationUrl,

                    competition_date:
                        convertDate(competitionDateText) ||
                        competitionDateText ||
                        null,

                    pool_length: competitionPoolInfo.poolLength,
                    pool_length_reason: competitionPoolInfo.reason,

                    status: competitionStatus,
                    events_found: events.length,
                    last_checked: new Date().toISOString()
                });

                if (events.length === 0) {
                    console.log(
                        '  לא נמצאו משחים עם קישורי תוצאות.'
                    );

                    console.log(
                        `  התחרות נשמרה. סטטוס: ${competitionStatus}`
                    );

                    continue;
                }

                console.log(`  נמצאו ${events.length} משחים.`);

                // שלב ו': מעבר על כל המשחים

                for (const event of events) {
                    if (
                        event.discipline.includes('שליחים') ||
                        event.category.includes('שליחים')
                    ) {
                        continue;
                    }

                    const eventDateText =
                        event.dateText || competitionDateText;

                    const poolInfo = getPoolLengthFromRules({
                        regulationText,
                        competitionTitle: compTitle,
                        competitionPageText,
                        dateText: eventDateText
                    });

                    const poolLength = poolInfo.poolLength;

                    const eventUrl = new URL(
                        event.resultsUrl,
                        logligUrl
                    ).href;

                    try {
                        console.log(
                            `  קורא תוצאות: ${event.discipline} - ${event.category}`
                        );

                        await page.goto(eventUrl, {
                            waitUntil: 'domcontentloaded',
                            timeout: 30000
                        });

                        // שלב ז': חילוץ השחיינים

                        const scrapeData = await page.evaluate(() => {
                            const tables = Array.from(
                                document.querySelectorAll('table')
                            );

                            const resultsTable = tables.find(table => {
                                const headers = Array.from(
                                    table.querySelectorAll('th')
                                ).map(th => th.innerText.trim());

                                return (
                                    headers.includes('שם מלא') &&
                                    headers.includes('שנת לידה') &&
                                    headers.includes('תוצאות')
                                );
                            });

                            if (!resultsTable) {
                                return {
                                    results: [],
                                    debugBirthYear: null,
                                    tableMissing: true
                                };
                            }

                            const headers = Array.from(
                                resultsTable.querySelectorAll('th')
                            ).map(th => th.innerText.trim());

                            const indexes = {
                                position: headers.indexOf('מיקום'),
                                name: headers.indexOf('שם מלא'),
                                birthYear: headers.indexOf('שנת לידה'),
                                club: headers.indexOf('אגודה'),
                                heat: headers.indexOf('מקצה'),
                                lane: headers.indexOf('מסלול'),
                                time: headers.indexOf('תוצאות'),
                                points: headers.indexOf('ניקוד')
                            };

                            const rows = Array.from(
                                resultsTable.querySelectorAll('tr')
                            );

                            const results = [];

                            for (const row of rows) {
                                const cells = Array.from(
                                    row.querySelectorAll('th, td')
                                ).map(cell => cell.innerText.trim());

                                const getValue = key => {
                                    const index = indexes[key];

                                    return index >= 0
                                        ? (cells[index] || '')
                                        : '';
                                };
                                const position = getValue('position');
                                const fullName = getValue('name');
                                const birthYear = getValue('birthYear');
                                const club = getValue('club');
                                const heat = getValue('heat');
                                const lane = getValue('lane');
                                const time = getValue('time');
                                const points = getValue('points');

                                if (!/^\d+$/.test(position)) continue;
                                if (!fullName) continue;

                                const validTime =
                                    /^\d{1,2}:\d{2}\.\d{2}$/.test(time) ||
                                    /^\d{1,2}\.\d{2}$/.test(time);

                                if (!validTime) continue;

                                results.push({
                                    position,
                                    fullName,

                                    birthYear: /^(19|20)\d{2}$/.test(birthYear)
                                        ? birthYear
                                        : null,

                                    club: club || null,
                                    heat: heat || null,
                                    lane: lane || null,
                                    time,

                                    aquaPoints: /^\d+$/.test(points)
                                        ? Number(points)
                                        : null
                                });
                            }

                           return {
                              results,
                              tableMissing: false
                           };
                        });

                        // קבלת התוצאות והצגת נתוני האבחון ב-Terminal
                        const swimmers = scrapeData.results;

                        if (scrapeData.tableMissing) {
                            console.log('  לא נמצאה טבלת תוצאות. מדלג על המשחה וממשיך.');
                            continue;
                        }

                        // שלב ח': שמירת התוצאות

                        for (const swimmer of swimmers) {
                            const swimmerId = createSwimmerId(
                                swimmer.fullName,
                                swimmer.birthYear
                            );

                            const resultId = createResultId(
                                eventUrl,
                                swimmer.fullName,
                                swimmer.birthYear,
                                swimmer.time
                            );

                            const resultObject = {
                                result_id: resultId,

                                swimmer_id: swimmerId,

                                swimmer: {
                                    first_name: swimmer.fullName,
                                    last_name: '',
                                    full_name: swimmer.fullName
                                },

                                gender: getGender(event.category),

                                birth_year: swimmer.birthYear,

                                club: {
                                    name_he: swimmer.club
                                },

                                discipline: event.discipline,
                                category: event.category,

                                pool_length: poolLength,

                                time: swimmer.time,
                                points: swimmer.aquaPoints,
                                position: swimmer.position,

                                heat: swimmer.heat,
                                lane: swimmer.lane,

                                competition: compTitle,

                                competition_date:
                                    convertDate(eventDateText),

                                source: 'Loglig',

                                event_url: eventUrl
                            };

                            const existingResult = resultsMap.get(resultId);

resultsMap.set(resultId, {
    ...(existingResult || {}),
    ...resultObject,
    birth_year:
        resultObject.birth_year ||
        existingResult?.birth_year ||
        null
});
                        }

                        console.log(
                            `  נמצאו ${swimmers.length} תוצאות תקינות. ` +
                            `בריכה: ${poolLength} מטר (${poolInfo.reason}).`
                        );

                    } catch (eventError) {
                        console.log(
                            `  שגיאה במשחה ${event.discipline}: ${eventError.message}`
                        );
                    }
                }

            } catch (competitionError) {
                scanHadErrors = true;
                console.log(
                    `שגיאה בתחרות ${compTitle}: ${competitionError.message}`
                );
            }
        }

        // שלב ט': שמירת התוצאות המעודכנות

        const allResults = Array.from(resultsMap.values());

        if (scanHadErrors) {
            throw new Error(
             'הסריקה נכשלה בחלק מהמשחים. הקבצים הקיימים לא יעודכנו.'
            );
        }

        fs.mkdirSync(path.dirname(RESULTS_PATH), {
            recursive: true
        });

        safeWriteJson(RESULTS_PATH, allResults);

        // שלב י': שמירת מידע על כל התחרויות

        safeWriteJson(METADATA_PATH, competitionMetadata);

        console.log('\n================================');
        console.log('הסריקה הסתיימה!');
        console.log(`תוצאות שהיו קיימות: ${existingResults.length}`);
        console.log(`תוצאות לאחר העדכון: ${allResults.length}`);
        console.log(`תחרויות שנשמרו: ${competitionMetadata.length}`);

        console.log(
            `תחרויות ללא עמוד תוצאות: ${
                competitionMetadata.filter(
                    comp => comp.status === 'no_results_page'
                ).length
            }`
        );

        console.log(
            `תחרויות עם עמוד ללא משחים: ${
                competitionMetadata.filter(
                    comp => comp.status === 'no_results_yet'
                ).length
            }`
        );

        console.log(`קובץ תוצאות: ${RESULTS_PATH}`);
        console.log(`קובץ תחרויות: ${METADATA_PATH}`);
        console.log('================================');

    } catch (error) {
        console.error('שגיאה כללית:', error.message);
        process.exitCode = 1;

    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

scrapeLogligResults();
