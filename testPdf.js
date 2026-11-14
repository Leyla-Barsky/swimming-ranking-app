
const fs = require('fs');
const { PDFParse } = require('pdf-parse');

// זיהוי אורך הבריכה מתוך התקנון
function detectPoolLength(text) {
    // איחוד רווחים, ירידות שורה ורווחים בין אותיות
    const cleanText = text.replace(/\s+/g, '');

    // זיהוי 25 מטר
    const is25 =
        /25(?:מטר|מ['׳״"]?)/.test(cleanText);

    // זיהוי 50 מטר
    const is50 =
        /50(?:מטר|מ['׳״"]?)/.test(cleanText);

    // זיהוי בריכה קצרה או ארוכה
    const isShort =
        /בריכ[הת]?קצרה/.test(cleanText);

    const isLong =
        /בריכ[הת]?ארוכה/.test(cleanText);

    // אם נמצאו נתונים סותרים, לא מנחשים
    if ((is25 && is50) || (isShort && isLong)) {
        return null;
    }

    if (is25 || isShort) return 25;
    if (is50 || isLong) return 50;

    return null;
}

async function readPdf() {
    const buffer = fs.readFileSync('./test-regulation.pdf');

    const parser = new PDFParse({ data: buffer });

    try {
        const result = await parser.getText();

        console.log('==============================');
        console.log('בדיקת קריאת תקנון');
        console.log('==============================');

        console.log('מספר עמודים:', result.total);

        const poolLength = detectPoolLength(result.text);

        console.log(
            'אורך הבריכה שזוהה:',
            poolLength ?? 'לא נמצא או נמצאו נתונים סותרים'
        );

        console.log('\n===== תוכן התקנון =====\n');
        console.log(result.text.slice(0, 5000));

    } finally {
        await parser.destroy();
    }
}

readPdf().catch(error => {
    console.error('שגיאה בקריאת PDF:', error);
});
