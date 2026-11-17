
import React, { useState, useEffect } from 'react';
import './App.css';

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

// זיהוי סוג הבריכה לצורך השוואת תוצאות
function getPoolKey(item) {
  if (item.pool_length) {
    return String(item.pool_length);
  }

  const competition = item.competition || '';

  return competition.includes('50') ? '50' : '25';
}

// זיהוי השחיין לפי מזהה ייחודי, עם גיבוי לשם ולפרטים נוספים
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

  useEffect(() => {
    fetch('/master_swimming_database.json')
      .then((res) => res.json())
      .then((data) => {
        const cleanData = data.filter(item => {
          const disc = item.discipline || '';

          const isInvalid = (
            disc.includes('שליחים') ||
            disc.includes('משחה כללי') ||
            disc.includes('גברים') ||
            disc.includes('נשים') ||
            disc.includes('בנים') ||
            disc.includes('בנות') ||
            disc.length > 25
          );

          return !isInvalid;
        });

        const uniqueData = cleanData.filter((item, index, self) =>
          index === self.findIndex((t) => (
            t.swimmer?.first_name === item.swimmer?.first_name &&
            t.time === item.time &&
            t.competition === item.competition &&
            t.discipline === item.discipline
          ))
        );

        setSwimmers(uniqueData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("שגיאה בטעינת הנתונים:", err);
        setLoading(false);
      });
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

  const years = [
    'הכל',
    ...Array.from({ length: 18 }, (_, i) => String(2003 + i))
  ];

  // שלב ראשון: סינון התוצאות לפי בחירות המשתמש
  const filteredSwimmers = swimmers
    .filter((item) => {
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
            genderMatch = text.includes('בנים') || text.includes('גברים');
          }

          if (selectedGender === 'בנות') {
            genderMatch = text.includes('בנות') || text.includes('נשים');
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

      // העדפת התאריך שמופיע בשם התחרות
      const compDate =
        extractIsoDate(item.competition) ||
        item.competition_date ||
        '';

      const dateFromMatch =
        !dateFrom || (compDate && compDate >= dateFrom);

      const dateToMatch =
        !dateTo || (compDate && compDate <= dateTo);

      const swimmerName = `
        ${item.swimmer?.first_name || ''}
        ${item.swimmer?.last_name || ''}
        ${item.name || ''}
      `.toLowerCase();

      const searchMatch =
        !appliedSearch ||
        swimmerName.includes(appliedSearch.toLowerCase());

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

  // שלב שני: בחירת התוצאה המהירה ביותר לכל שחיין, משחה ובריכה
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

  // ספירת שחיינים ייחודיים בתוצאות המוצגות
  const uniqueSwimmerCount = new Set(
    displayedSwimmers.map(item => getSwimmerKey(item))
  ).size;

  return (
    <div style={{
      direction: 'rtl',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1300px',
      margin: '0 auto',
      backgroundColor: '#f4f6f9',
      minHeight: '100vh'
    }}>

      <header style={{
        textAlign: 'center',
        marginBottom: '25px'
      }}>
        <h1 style={{
          color: '#0056b3',
          margin: '0 0 5px 0'
        }}>
          מאגר דירוג שחייה - ישראל
        </h1>
      </header>

      {/* פנל סינונים עליון */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        marginBottom: '30px'
      }}>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '15px',
          marginBottom: '20px'
        }}>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#555',
              marginBottom: '5px'
            }}>
              סגנון
            </label>

            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                fontSize: '14px',
                backgroundColor: '#fff'
              }}
            >
              {disciplines.map((disc, idx) => (
                <option key={idx} value={disc}>{disc}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#555',
              marginBottom: '5px'
            }}>
              מגדר
            </label>

            <div style={{ display: 'flex', gap: '5px' }}>
              {['הכל', 'בנים', 'בנות'].map((gender) => (
                <button
                  key={gender}
                  onClick={() => setSelectedGender(gender)}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    backgroundColor: selectedGender === gender ? '#0056b3' : '#f8f9fa',
                    color: selectedGender === gender ? '#fff' : '#333',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '13px'
                  }}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#555',
              marginBottom: '5px'
            }}>
              בריכה
            </label>

            <div style={{ display: 'flex', gap: '5px' }}>
              {['הכל', '50 מטר', '25 מטר'].map((pool) => {
                const val =
                  pool === 'הכל'
                    ? 'הכל'
                    : (pool.includes('50') ? '50' : '25');

                return (
                  <button
                    key={pool}
                    onClick={() => setSelectedPool(val)}
                    style={{
                      flex: 1,
                      padding: '9px',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      backgroundColor: selectedPool === val ? '#0056b3' : '#f8f9fa',
                      color: selectedPool === val ? '#fff' : '#333',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '13px'
                    }}
                  >
                    {pool}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '15px',
          marginBottom: '20px',
          alignItems: 'flex-end'
        }}>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#555',
              marginBottom: '5px'
            }}>
              שנת לידה
            </label>

            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}>
              <select
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  fontSize: '14px',
                  backgroundColor: '#fff'
                }}
              >
                {years.map((y, idx) => (
                  <option key={idx} value={y}>
                    {y === 'הכל' ? 'מ-שנה' : y}
                  </option>
                ))}
              </select>

              <span>עד</span>

              <select
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  fontSize: '14px',
                  backgroundColor: '#fff'
                }}
              >
                {years.map((y, idx) => (
                  <option key={idx} value={y}>
                    {y === 'הכל' ? 'עד-שנה' : y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#555',
              marginBottom: '5px'
            }}>
              תקופה (תאריכים)
            </label>

            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  fontSize: '13px'
                }}
              />

              <span>עד</span>

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>

        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          borderTop: '1px solid #eee',
          paddingTop: '15px'
        }}>

          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#555',
              marginBottom: '5px'
            }}>
              חיפוש שחיין/ית
            </label>

            <input
              type="text"
              placeholder="הקלידו שם פרטי ומשפחה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setAppliedSearch(searchTerm);
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <button
              onClick={() => setAppliedSearch(searchTerm)}
              style={{
                padding: '10px 25px',
                backgroundColor: '#d9534f',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              חפש
            </button>
          </div>

        </div>

        {/* תיבת סימון וספירת שחיינים באותה שורה */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '12px',
          marginBottom: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <input
              id="showBestResults"
              type="checkbox"
              checked={showBestResults}
              onChange={(e) => setShowBestResults(e.target.checked)}
            />

            <label
              htmlFor="showBestResults"
              style={{
                fontSize: '13px',
                color: '#555',
                cursor: 'pointer'
              }}
            >
              הצג תוצאה הטובה ביותר לשחיין/ית   
            </label>
          </div>

          <div style={{
            fontSize: '13px',
            color: '#555'
          }}>
            נמצאו: {uniqueSwimmerCount} תוצאות
          </div>
        </div>

      </div>

      {/* טבלת תוצאות */}
      {loading ? (
        <p style={{
          textAlign: 'center',
          fontSize: '18px'
        }}>
          טוען נתונים...
        </p>
      ) : (
        <div>

          <div style={{
            backgroundColor: '#0056b3',
            color: '#fff',
            borderRadius: '10px 10px 0 0',
            overflow: 'hidden'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'right'
            }}>
              <thead>
                <tr style={{ fontSize: '14px' }}>
                  <th style={{ padding: '15px', width: '80px' }}>מיקום</th>
                  <th style={{ padding: '15px' }}>שחיין/ית / אגודה</th>
                  <th style={{ padding: '15px', width: '90px' }}>שנת לידה</th>
                  <th style={{ padding: '15px' }}>תחרות</th>
                  <th style={{
                    padding: '15px',
                    textAlign: 'left',
                    width: '150px'
                  }}>
                    תוצאה
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            {displayedSwimmers.length > 0 ? (
              displayedSwimmers.slice(0, 100).map((row, index) => {
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

                const isValidName = (name) => {
                  const cleanName = String(name || '').trim();

                  return (
                    cleanName !== '' &&
                    !invalidNames.includes(cleanName) &&
                    !/^\d/.test(cleanName)
                  );
                };

                const fullName =
                  possibleNames.find(isValidName) || 'שחיין לא ידוע';

                const clubName = row.club?.name_he || 'אגודה';
                const birthYear = row.birth_year || '-';
                const competitionInfo = row.competition || 'תחרות שחייה';

                const competitionDate =
                  extractIsoDate(competitionInfo) ||
                  row.competition_date ||
                  '';

                return (
                  <div
                    key={`${getSwimmerKey(row)}-${row.discipline}-${getPoolKey(row)}-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 15px',
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? '#fff' : '#fcfdff'
                    }}
                  >
                    <div style={{
                      width: '80px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor:
                          index === 0 ? '#d9534f' :
                          index === 1 ? '#f0ad4e' :
                          index === 2 ? '#5bc0de' : '#e9ecef',
                        color: index < 3 ? '#fff' : '#333',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {index + 1}
                      </span>
                    </div>

                    <div style={{
                      flex: 2,
                      paddingRight: '10px'
                    }}>
                      <div style={{
                        fontWeight: 'bold',
                        color: '#222',
                        fontSize: '15px'
                      }}>
                        {fullName}
                      </div>

                      <div style={{
                        fontSize: '13px',
                        color: '#777',
                        marginTop: '2px'
                      }}>
                        {clubName}
                      </div>
                    </div>

                    <div style={{
                      width: '90px',
                      fontSize: '14px',
                      color: '#444',
                      fontWeight: '500'
                    }}>
                      {birthYear}
                    </div>

                    <div style={{
                      flex: 2,
                      fontSize: '13px',
                      color: '#566'
                    }}>
                      {competitionInfo}

                      {competitionDate && !extractIsoDate(competitionInfo) && (
                        <div style={{
                          fontSize: '12px',
                          color: '#777',
                          marginTop: '4px'
                        }}>
                          {competitionDate.split('-').reverse().join('/')}
                        </div>
                      )}
                    </div>

                    <div style={{
                      width: '150px',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        color: '#0056b3'
                      }}>
                        {row.time || '-'}
                      </div>

                      <div style={{
                        fontSize: '11px',
                        color: '#2b7a78',
                        fontWeight: 'bold',
                        marginTop: '2px'
                      }}>
                        {row.points !== '-' ? `FINA ${row.points}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{
                textAlign: 'center',
                padding: '30px',
                color: '#777'
              }}>
                לא נמצאו תוצאות התואמות את הסינונים הנבחרים.
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default App;
