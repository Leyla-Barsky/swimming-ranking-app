
import React, { useState, useEffect } from 'react';
import './App.css';

// המרת זמן למספר שניות לצורך מיון
function timeToSeconds(timeStr) {
  if (!timeStr || timeStr === '-' || timeStr === '00:00.00') {
    return 999999;
  }

  const parts = String(timeStr).split(':').map(Number);

  if (parts.some(part => Number.isNaN(part))) {
    return 999999;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] || 999999;
}

// חילוץ תאריך מתוך שם התחרות
function extractIsoDate(compStr) {
  if (!compStr) return '';

  const match = compStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return '';
}

// מיון לפי הסדר הספורטיבי של המשחים
function getDisciplineOrder(disc) {
  if (!disc) return 9999;

  const d = disc.toLowerCase();
  const match = d.match(/\d+/);
  const distance = match ? parseInt(match[0], 10) : 50;

  if (d.includes('חופשי')) return distance;
  if (d.includes('גב')) return 2000 + distance;
  if (d.includes('חזה')) return 3000 + distance;
  if (d.includes('פרפר')) return 4000 + distance;
  if (d.includes('מעורב')) return 5000 + distance;

  return 9999;
}

// זיהוי סוג הבריכה
function getPoolKey(item) {
  if (item.pool_length) {
    return String(item.pool_length);
  }

  const competition = item.competition || '';

  return competition.includes('50') ? '50' : '25';
}

// זיהוי שחיין לפי מזהה ייחודי
function getSwimmerKey(item) {
  if (item.swimmer_id) {
    return String(item.swimmer_id);
  }

  const name =
    item.swimmer?.full_name ||
    item.swimmer?.first_name ||
    item.name ||
    '';

  return [
    name.trim().toLowerCase(),
    item.birth_year || '',
    item.gender || '',
    item.club?.name_he || ''
  ].join('|');
}

function App() {
  const [swimmers, setSwimmers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDiscipline, setSelectedDiscipline] = useState('הכל');
  const [selectedGender, setSelectedGender] = useState('הכל');
  const [selectedPool, setSelectedPool] = useState('הכל');

  const [yearFrom, setYearFrom] = useState('הכל');
  const [yearTo, setYearTo] = useState('הכל');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [showBestResults, setShowBestResults] = useState(false);

  // טעינת מאגר השחייה מ-GitHub
  useEffect(() => {
    const DATA_URL = '/master_swimming_database.json';
    const loadData = async () => {
      try {
        const response = await fetch(`${DATA_URL}?t=${Date.now()}`, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // הסרת קטגוריות שאינן משחים אישיים
        const cleanData = data.filter(item => {
          const disc = item.discipline || '';

          return !(
            disc.includes('שליחים') ||
            disc.includes('משחה כללי') ||
            disc.includes('גברים') ||
            disc.includes('נשים') ||
            disc.includes('בנים') ||
            disc.includes('בנות') ||
            disc.length > 25
          );
        });

        // מניעת כפילויות לפי מזהה תוצאה
        const uniqueData = cleanData.filter((item, index, self) =>
          index === self.findIndex(t =>
            t.result_id === item.result_id
          )
        );

        setSwimmers(uniqueData);

        console.log(
          'מאגר השחייה עודכן בהצלחה:',
          uniqueData.length,
          'תוצאות'
        );

      } catch (err) {
        console.error('שגיאה בטעינת הנתונים:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // בדיקת עדכונים חדשים כל חמש דקות
    const interval = setInterval(loadData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // רשימת המשחים במסנן
  const disciplines = [
    'הכל',
    ...Array.from(
      new Set(swimmers.map(item => item.discipline).filter(Boolean))
    )
      .filter(disc => {
        const d = disc.toLowerCase();

        return (
          d.includes('חופשי') ||
          d.includes('גב') ||
          d.includes('חזה') ||
          d.includes('פרפר') ||
          d.includes('מעורב')
        );
      })
      .sort((a, b) => getDisciplineOrder(a) - getDisciplineOrder(b))
  ];


// רשימת שנות הלידה מתוך מסד הנתונים
const years = [
  'הכל',
  ...[...new Set(
    swimmers
      .map(item => String(item.birth_year || '').trim())
      .filter(year => Number(year) >= 1998 && Number(year) <= 2019)
  )].sort((a, b) => Number(a) - Number(b))
];


  // סינון התוצאות
  const filteredSwimmers = swimmers
    .filter(item => {
      const disciplineMatch =
        selectedDiscipline === 'הכל' ||
        item.discipline === selectedDiscipline;

      let genderMatch = true;

      if (selectedGender !== 'הכל') {
        if (item.gender && item.gender !== 'לא ידוע') {
          genderMatch = item.gender === selectedGender;
        } else {
          const text = `${item.discipline || ''} ${item.competition || ''}`;

          if (selectedGender === 'בנים') {
            genderMatch =
              text.includes('בנים') || text.includes('גברים');
          }

          if (selectedGender === 'בנות') {
            genderMatch =
              text.includes('בנות') || text.includes('נשים');
          }
        }
      }

      let poolMatch = true;

      if (selectedPool !== 'הכל') {
        if (item.pool_length) {
          poolMatch = String(item.pool_length) === selectedPool;
        } else {
          const text = item.competition || '';

          poolMatch = selectedPool === '50'
            ? text.includes('50')
            : !text.includes('50');
        }
      }

      const birthYear = parseInt(item.birth_year);

      const yearFromMatch =
        yearFrom === 'הכל' ||
        (!isNaN(birthYear) && birthYear >= parseInt(yearFrom));

      const yearToMatch =
        yearTo === 'הכל' ||
        (!isNaN(birthYear) && birthYear <= parseInt(yearTo));

      // חיפוש לפי שם מלא, פרטי או משפחה
      const swimmerName = [
        item.swimmer?.full_name,
        item.swimmer?.first_name,
        item.swimmer?.last_name,
        item.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const searchMatch =
        !appliedSearch ||
        swimmerName.includes(appliedSearch.toLowerCase());

      // סינון לפי תאריך
      const compDate =
        extractIsoDate(item.competition) ||
        item.competition_date ||
        '';

      const dateFromMatch =
        !dateFrom || (compDate && compDate >= dateFrom);

      const dateToMatch =
        !dateTo || (compDate && compDate <= dateTo);

      return (
        disciplineMatch &&
        genderMatch &&
        poolMatch &&
        yearFromMatch &&
        yearToMatch &&
        dateFromMatch &&
        dateToMatch &&
        searchMatch
      );
    })
    .sort((a, b) => {
      const orderA = getDisciplineOrder(a.discipline);
      const orderB = getDisciplineOrder(b.discipline);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return timeToSeconds(a.time) - timeToSeconds(b.time);
    });

  // בחירת התוצאה המהירה ביותר לכל שחיין, משחה ובריכה
  const displayedSwimmers = showBestResults
    ? Array.from(
        filteredSwimmers.reduce((bestResults, item) => {
          const key = [
            getSwimmerKey(item),
            item.discipline || '',
            getPoolKey(item)
          ].join('|');

          const currentBest = bestResults.get(key);

          if (
            !currentBest ||
            timeToSeconds(item.time) < timeToSeconds(currentBest.time)
          ) {
            bestResults.set(key, item);
          }

          return bestResults;
        }, new Map()).values()
      ).sort((a, b) => {
        const orderA = getDisciplineOrder(a.discipline);
        const orderB = getDisciplineOrder(b.discipline);

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return timeToSeconds(a.time) - timeToSeconds(b.time);
      })
    : filteredSwimmers;

  // מספר שחיינים ייחודיים בתוצאות המוצגות
  const uniqueSwimmerCount = new Set(
    displayedSwimmers.map(item => getSwimmerKey(item))
  ).size;

  // ניקוי החיפוש
  const clearSearch = () => {
    setSearchTerm('');
    setAppliedSearch('');
  };

  // הצגת שם שחיין
  const getSwimmerName = row => {
    const possibleNames = [
      row.swimmer?.full_name,
      row.swimmer?.first_name,
      row.name
    ];

    const invalidNames = [
      'חופשי',
      'גב',
      'חזה',
      'פרפר',
      'מעורב'
    ];

    return (
      possibleNames.find(name => {
        const cleanName = String(name || '').trim();

        return (
          cleanName !== '' &&
          !invalidNames.includes(cleanName) &&
          !/^\d/.test(cleanName)
        );
      }) || 'שחיין לא ידוע'
    );
  };

  return (
    <div className="app-container">

      {/* כותרת האתר */}
      <header className="app-header">
        <h1>דירוג זמנים מובילים </h1>
        <p>מאגר תוצאות שחייה תחרותית בישראל</p>
      </header>

      {/* אזור המסננים */}
      <section className="filters-panel">

        <div className="filters-grid">

          {/* סגנון */}
          <div className="filter-group">
            <label>סגנון ומשחה</label>

            <select
              value={selectedDiscipline}
              onChange={e => setSelectedDiscipline(e.target.value)}
            >
              {disciplines.map((disc, idx) => (
                <option key={idx} value={disc}>
                  {disc}
                </option>
              ))}
            </select>
          </div>

          {/* מגדר */}
          <div className="filter-group">
            <label>מגדר</label>

            <div className="filter-buttons">
              {['הכל', 'בנים', 'בנות'].map(gender => (
                <button
                  type="button"
                  key={gender}
                  className={selectedGender === gender ? 'active' : ''}
                  onClick={() => setSelectedGender(gender)}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          {/* בריכה */}
          <div className="filter-group">
            <label>אורך בריכה</label>

            <div className="filter-buttons">
              {['הכל', '50 מטר', '25 מטר'].map(pool => {
                const val =
                  pool === 'הכל'
                    ? 'הכל'
                    : pool.includes('50') ? '50' : '25';

                return (
                  <button
                    type="button"
                    key={pool}
                    className={selectedPool === val ? 'active' : ''}
                    onClick={() => setSelectedPool(val)}
                  >
                    {pool}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* שנות לידה ותאריכים */}
        <div className="filter-row">

          <div className="filter-group">
            <label>שנת לידה</label>

            <div className="year-inputs">
              <select
                value={yearFrom}
                onChange={e => setYearFrom(e.target.value)}
              >
                {years.map((year, idx) => (
                  <option key={idx} value={year}>
                    {year === 'הכל' ? 'משנה' : year}
                  </option>
                ))}
              </select>

              <span>עד</span>

              <select
                value={yearTo}
                onChange={e => setYearTo(e.target.value)}
              >
                {years.map((year, idx) => (
                  <option key={idx} value={year}>
                    {year === 'הכל' ? 'עד שנה' : year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-group">
            <label>תקופה (תאריכים)</label>

            <div className="date-inputs">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />

              <span>עד</span>

              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

        </div>

        {/* חיפוש שחיין */}
        <div className="search-row">

          <div className="filter-group">
            <label>חיפוש שחיין/ית</label>

            <div className="search-wrapper">
              <input
                type="text"
                placeholder="הקלידו שם פרטי ומשפחה..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setAppliedSearch(searchTerm);
                  }
                }}
              />

              {searchTerm && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={clearSearch}
                  title="ניקוי החיפוש"
                  aria-label="ניקוי החיפוש"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className="search-button"
            onClick={() => setAppliedSearch(searchTerm)}
          >
            חפש
          </button>

        </div>

        {/* תוצאה הטובה ביותר וספירת שחיינים */}
        <div className="filters-footer">

          <label className="best-results-option">
            <input
              type="checkbox"
              checked={showBestResults}
              onChange={e => setShowBestResults(e.target.checked)}
            />

            הצג תוצאה הטובה ביותר לשחיין/ית
          </label>

          <div className="results-count">
            נמצאו {uniqueSwimmerCount} שחיינים
          </div>

        </div>

      </section>

      {/* אזור התוצאות */}
      {loading ? (

        <div className="results-section">
          <div className="loading-message">
            טוען נתוני שחייה...
          </div>
        </div>

      ) : (

        <section className="results-section">

          <div className="results-heading">
             <h2>תוצאות דירוג</h2>
          </div>

          <div className="table-scroll">

           


<table className="results-table">
  <thead>
    <tr>
      <th>מיקום</th>
      <th>שחיין/ית</th>
      <th className="mobile-portrait-hide">שנת לידה</th>
      <th className="mobile-portrait-hide">משחה</th>
      <th>תחרות</th>
      <th>זמן</th>
      <th className="mobile-portrait-hide">ניקוד AQUA</th>
    </tr>
  </thead>

  <tbody>
    {displayedSwimmers.length > 0 ? (
      displayedSwimmers.slice(0, 100).map((row, index) => {
        const fullName = getSwimmerName(row);
        const clubName = row.club?.name_he || 'אגודה';
        const birthYear = row.birth_year || '-';
        if (row.birth_year == null || row.birth_year === '') {
          console.log('בדיקת שנת לידה:', JSON.stringify(row, null, 2));   
         }
        const competitionInfo = row.competition || 'תחרות שחייה';

        const competitionDate =
          extractIsoDate(competitionInfo) ||
          row.competition_date ||
          '';

        const points =
          row.points != null && row.points !== '-'
            ? row.points
            : '-';

        const rankClass =
          index === 0 ? 'first' :
          index === 1 ? 'second' :
          index === 2 ? 'third' : '';

        return (
          <tr
            key={
              row.result_id ||
              `${getSwimmerKey(row)}-${row.discipline}-${getPoolKey(row)}-${index}`
            }
          >
            <td>
              <span className={`rank-number ${rankClass}`}>
                {index + 1}
              </span>
            </td>

            <td className="swimmer-info-cell">
              <div className="swimmer-name">{fullName}</div>
              <div className="swimmer-club">{clubName}</div>
            </td>

            <td className="mobile-portrait-hide">
              {birthYear}
            </td>

            <td className="discipline-cell mobile-portrait-hide">
              {row.discipline || '-'}
            </td>

            <td className="competition-cell">
              <div>{competitionInfo}</div>
              {competitionDate &&
                !extractIsoDate(competitionInfo) && (
                  <div className="swimmer-club">
                    {competitionDate.split('-').reverse().join('/')}
                  </div>
                )}
            </td>

            <td className="time-cell">
              {row.time || '-'}
            </td>

            <td className="points-cell mobile-portrait-hide">
              {points}
            </td>
          </tr>
        );
      })
    ) : (
      <tr>
        <td colSpan="7">
          <div className="empty-message">
            לא נמצאו תוצאות התואמות את הסינונים הנבחרים.
          </div>
        </td>
      </tr>
    )}
  </tbody>
</table>

          </div>

        </section>

      )}

    </div>
  );
}

export default App;
