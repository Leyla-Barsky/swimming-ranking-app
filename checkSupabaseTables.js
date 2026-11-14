const axios = require('axios');

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cW1nd3BsYnpmc25vY25luvwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTgyMjksImV4cCI6MjA4MjA3NDIyOX0.ldrXAo9tqWikTAXGdxmMs6sj1g_SDDPLtyMnzsVFCVY';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
};

async function testSupabase() {
    try {
        console.log("בודק חיבור וניסיון שליפה מטבלת swimmers...");
        const res = await axios.get('https://nxqmgwplbzfsnocnluvw.supabase.co/rest/v1/swimmers?limit=1', { headers });
        console.log("הצלחה! מבנה טבלת השחיינים:", res.data);
    } catch (err) {
        console.log("שגיאה בשליפה מטבלת swimmers:", err.response?.status, err.response?.data || err.message);
    }
}

testSupabase();
