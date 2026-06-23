'use client'
import { useState, useEffect } from 'react'

const CATEGORIES = [
  { key: '금융', label: '💰 금융', color: '#2563eb' },
  { key: '기술', label: '⚙️ 기술', color: '#7c3aed' },
  { key: '창업', label: '🚀 창업', color: '#16a34a' },
  { key: '인력', label: '👥 인력', color: '#ea580c' },
  { key: '수출', label: '🌏 수출', color: '#0891b2' },
  { key: '경영', label: '📊 경영', color: '#be185d' },
]

const POLICY_KEYWORDS = ['이차보전', '자금', '보증', '육성', '융자']

export default function BizCalendar() {
  const [selectedCategory, setSelectedCategory] = useState('금융')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [view, setView] = useState('calendar')

  useEffect(() => {
    fetchData(selectedCategory)
  }, [selectedCategory])

  const fetchData = async (category) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bizinfo?category=${encodeURIComponent(category)}&pageUnit=100`)
      const data = await res.json()
let list = data?.jsonArray || []
if (selectedCategory === '금융') {
  list = list.filter(item => {
    const title = item.pblancNm || ''
    return POLICY_KEYWORDS.some(keyword => title.includes(keyword))
  })
}
setItems(Array.isArray(list) ? list : [list])
    } catch (e) {
      setItems([])
    }
    setLoading(false)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

 const itemsByDay = {}
items.forEach(item => {
  const raw = item.reqstBeginEndDe || ''
  if (!raw.includes('~')) return
  const endStr = raw.split('~')[1]?.trim()
  if (!endStr || endStr.length < 8) return
  const cleaned = endStr.replace(/-/g, '')
  const itemYear = parseInt(cleaned.slice(0, 4))
  const itemMonth = parseInt(cleaned.slice(4, 6)) - 1
  const itemDay = parseInt(cleaned.slice(6, 8))
  if (isNaN(itemYear) || isNaN(itemMonth) || isNaN(itemDay)) return
  if (itemYear === year && itemMonth === month) {
    if (!itemsByDay[itemDay]) itemsByDay[itemDay] = []
    itemsByDay[itemDay].push(item)
  }
})

  const selectedItems = selectedDay ? (itemsByDay[selectedDay] || []) : []
  const currentCat = CATEGORIES.find(c => c.key === selectedCategory)

  const getDday = (endDate) => {
    if (!endDate) return ''
    const end = new Date(endDate.replace(/-/g, '/'))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    if (diff < 0) return '마감'
    if (diff === 0) return 'D-Day'
    return `D-${diff}`
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => { setSelectedCategory(cat.key); setSelectedDay(null) }}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: selectedCategory === cat.key ? cat.color : '#f0f0f0',
              color: selectedCategory === cat.key ? 'white' : '#555',
            }}>
            {cat.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setView('calendar')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: view === 'calendar' ? '#0f3460' : '#f0f0f0', color: view === 'calendar' ? 'white' : '#555' }}>📅 캘린더</button>
          <button onClick={() => setView('list')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: view === 'list' ? '#0f3460' : '#f0f0f0', color: view === 'list' ? 'white' : '#555' }}>📋 목록</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>불러오는 중...</div>
      ) : view === 'calendar' ? (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 400px', background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ background: currentCat?.color || '#0f3460', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setCurrentDate(new Date(year, month - 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{year}년 {month + 1}월</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f8f8' }}>
              {['일','월','화','수','목','금','토'].map((d, i) => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600, color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#666' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ minHeight: 70 }} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayItems = itemsByDay[day] || []
                const isSelected = selectedDay === day
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
                return (
                  <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                    style={{
                      minHeight: 70, maxHeight: 80, overflow: 'hidden', padding: '6px 4px', border: '1px solid #f0f0f0', cursor: dayItems.length ? 'pointer' : 'default',
                      background: isSelected ? `${currentCat?.color}15` : 'white',
                      borderLeft: isSelected ? `3px solid ${currentCat?.color}` : '1px solid #f0f0f0',
                    }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? currentCat?.color : '#333', marginBottom: 2 }}>{day}</div>
                    {dayItems.slice(0, 2).map((item, idx) => (
  <div key={idx} style={{ 
    fontSize: 10, background: currentCat?.color, color: 'white', 
    borderRadius: 3, padding: '1px 4px', marginBottom: 2, 
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: '100%'
  }}>
    {item.pblancNm || item.pbanc_nm || '공고'}
  </div>
))}
                    {dayItems.length > 2 && <div style={{ fontSize: 10, color: '#888' }}>+{dayItems.length - 2}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ flex: '1 1 300px' }}>
            {selectedDay ? (
              <div>
                <h3 style={{ marginBottom: 12, color: '#333', fontSize: 15 }}>{month + 1}월 {selectedDay}일 마감 공고 ({selectedItems.length}건)</h3>
                {selectedItems.map((item, i) => (
                  <AnnouncementCard key={i} item={item} color={currentCat?.color} getDday={getDday} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa', background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 14 }}>날짜를 클릭하면<br/>공고를 확인할 수 있어요</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>총 {items.length}건</div>
          {items.map((item, i) => (
            <AnnouncementCard key={i} item={item} color={currentCat?.color} getDday={getDday} />
          ))}
        </div>
      )}
    </div>
  )
}

function AnnouncementCard({ item, color, getDday }) {
  const title = item.pblancNm || item.pbanc_nm || item.pbancNm || item.title || '공고명 없음'
  const org = item.excInstt_nm || item.excInsttNm || item.organ || ''
  const startDate = item.pbancBgngDe || item.reqstBgngDe || ''
  const endDate = item.pbancEndDe || item.reqstEndDe || (item.reqstBeginEndDe ? item.reqstBeginEndDe.split('~')[1]?.trim() : '') || ''
  const dday = getDday(endDate)
  const ddayColor = dday === '마감' ? '#aaa' : dday === 'D-Day' ? '#ef4444' : parseInt(dday.replace('D-', '')) <= 7 ? '#ef4444' : color
  const link = item.pblancUrl || item.detailUrl || ''

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 4, lineHeight: 1.4 }}>{title}</div>
          {org && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{org}</div>}
          {(startDate || endDate) && (
            <div style={{ fontSize: 12, color: '#aaa' }}>{startDate} ~ {endDate}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: ddayColor, background: `${ddayColor}15`, padding: '3px 8px', borderRadius: 10 }}>{dday}</span>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: color, border: `1px solid ${color}`, borderRadius: 6, padding: '3px 8px', textDecoration: 'none' }}>
              공고 보기
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
