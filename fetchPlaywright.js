const { chromium } = require('playwright');
const fs = require('fs');

async function debugCompetitionPage() {
    console.log("מתחיל בדיקה מעמיקה של עמוד תחרות...");
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        // נכנסים לתחרות הראשונה לדוגמה
        const targetUrl = 'https://isr.org.il/comp.asp?compID=16845';
        console.log(`גולש לכתובת: ${targetUrl}`);
        
        await page.goto(targetUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // נשמור את ה-HTML של העמוד לקובץ מקומי כדי שנוכל לראות את המבנה המדויק
        const htmlContent = await page.content();
        fs.writeFileSync('competition_debug.html', htmlContent, 'utf-8');
        console.log("קובץ הדיבאג 'competition_debug.html' נשמר בהצלחה בתיקיית הפרויקט!");

        // ננסה לחלץ את כל הטקסטים שנראים כמו שחיינים או תוצאות מכל אלמנט אפשרי בעמוד
        const extractedData = await page.evaluate(() => {
            const elements = document.querySelectorAll('td, span, div, a');
            const found = [];
            
            elements.forEach(el => {
                const text = el.innerText ? el.innerText.trim() : '';
                // חיפוש מחרוזות שנראות כמו זמני שחייה (למשל מכילות נקודתיים)
                if (text.length > 0 && text.length < 50 && (text.includes(':') || text.includes('.'))) {
                    found.push(text);
                }
            });
            return Array.from(new Set(found)).slice(0, 30);
        });

        console.log("דוגמאות לטקסטים שנמצאו בעמוד שמכילים זמנים/נקודות:", extractedData);

    } catch (error) {
        console.error("שגיאה בבדיקה:", error);
    } finally {
        await browser.close();
    }
}

debugCompetitionPage();