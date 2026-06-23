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
const REGIONS = ['전체', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

// 예산소진/상시 여부 판단
function isAlwaysOn(item) {
  const raw = item.reqstBeginEndDe || ''
  return (
    raw.includes('예산') ||
    raw.includes('소진') ||
    raw.includes('선착순') ||
    raw.includes('상시')
  )
}

// ────────────────────────────────────────────
// 정책자금 캘린더 (금융 카테고리 + 지역 필터)
// ────────────────────────────────────────────
function PolicyCalendar() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [view, setView] = useState('calendar')
  const [selectedRegion, setSelectedRegion] = useState('전체')

  useEffect(() => {
    fetchData(selectedRegion)
  }, [selectedRegion])

  const fetchData = async (region) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bizinfo?category=${encodeURIComponent('금융')}&pageUnit=100`)
      const data = await res.json()
      let list = data?.jsonArray || []

      // 정책자금 키워드 필터
      list = list.filter(item => {
        const title = item.pblancNm || ''
        return POLICY_KEYWORDS.some(keyword => title.includes(keyword))
      })

      // 지역 필터
      if (region !== '전체') {
        list = list.filter(item => {
          const hashtags = item.hashtags || ''
          return hashtags.includes(region)
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

  // 날짜별 공고 (예산소진 제외)
  const itemsByDay = {}
  const alwaysOnItems = []

  items.forEach(item => {
    if (isAlwaysOn(item)) {
      alwaysOnItems.push(item)
      return
    }
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
  const color = '#2563eb'

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
      {/* 안내 배너 */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1d4ed8', lineHeight: 1.6
      }}>
        💡 <strong>정책자금 캘린더</strong> — 이차보전·자금·보증·육성·융자 관련 지역별 금융지원 공고를 모아봅니다.<br />
        고객이 금리 문의 시, 시·도의 이차보전·육성사업을 지역별로 빠르게 확인하세요.
      </div>

      {/* 지역 필터 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {REGIONS.map(region => (
          <button key={region} onClick={() => { setSelectedRegion(region); setSelectedDay(null) }}
            style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: selectedRegion === region ? '#2563eb' : '#f0f0f0',
              color: selectedRegion === region ? 'white' : '#555',
            }}>
            {region}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setView('calendar')} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: view === 'calendar' ? '#0f3460' : '#f0f0f0', color: view === 'calendar' ? 'white' : '#555' }}>📅 캘린더</button>
          <button onClick={() => setView('list')} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: view === 'list' ? '#0f3460' : '#f0f0f0', color: view === 'list' ? 'white' : '#555' }}>📋 목록</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>불러오는 중...</div>
      ) : view === 'calendar' ? (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* 캘린더 그리드 */}
          <div style={{ flex: '1 1 0', background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ background: color, color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setCurrentDate(new Date(year, month - 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{year}년 {month + 1}월 — 정책자금</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f8f8' }}>
              {['일','월','화','수','목','금','토'].map((d, i) => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600, color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#666' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ height: 85 }} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayItems = itemsByDay[day] || []
                const isSelected = selectedDay === day
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
                return (
                  <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                    style={{
                      height: 85, overflow: 'hidden', padding: '6px 4px',
                      border: '1px solid #f0f0f0', cursor: 'pointer',
                      background: isSelected ? `${color}15` : 'white',
                      borderLeft: isSelected ? `3px solid ${color}` : '1px solid #f0f0f0',
                    }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? color : '#333', marginBottom: 2 }}>{day}</div>
                    {dayItems.slice(0, 2).map((item, idx) => (
                      <div key={idx} style={{
                        fontSize: 10, background: color, color: 'white',
                        borderRadius: 3, padding: '1px 4px', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.pblancNm || '공고'}
                      </div>
                    ))}
                    {dayItems.length > 2 && <div style={{ fontSize: 10, color: '#888' }}>+{dayItems.length - 2}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 오른쪽 공고 목록 */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            {/* 날짜별 마감 공고 */}
            {selectedDay ? (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 12, color: '#333', fontSize: 15 }}>
                  {month + 1}월 {selectedDay}일 마감 공고 ({selectedItems.length}건)
                </h3>
                {selectedItems.length > 0
                  ? selectedItems.map((item, i) => <AnnouncementCard key={i} item={item} color={color} getDday={getDday} />)
                  : <div style={{ color: '#aaa', fontSize: 13 }}>이 날 마감하는 공고가 없습니다.</div>
                }
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: '#aaa', background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 14 }}>날짜를 클릭하면<br />마감 공고를 확인할 수 있어요</div>
              </div>
            )}

            {/* 상시 진행중 — 항상 표시 */}
            {alwaysOnItems.length > 0 && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 10, paddingBottom: 8,
                  borderBottom: '1px dashed #e0e0e0'
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#555' }}>📌 상시 진행중</span>
                  <span style={{
                    fontSize: 11, background: '#f0fdf4', color: '#16a34a',
                    border: '1px solid #bbf7d0', borderRadius: 10, padding: '2px 8px'
                  }}>예산 소진 시 마감</span>
                  <span style={{ fontSize: 12, color: '#999' }}>({alwaysOnItems.length}건)</span>
                </div>
                {alwaysOnItems.map((item, i) => (
                  <AnnouncementCard key={i} item={item} color='#6b7280' getDday={getDday} alwaysOn />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // 목록 뷰
        <div>
          <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>총 {items.length}건</div>
          {items.map((item, i) => <AnnouncementCard key={i} item={item} color={color} getDday={getDday} alwaysOn={isAlwaysOn(item)} />)}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────
// 지원사업 캘린더 (전 카테고리, 전 지역, 전체 공고)
// ────────────────────────────────────────────
function SupportCalendar() {
  const [selectedCategory, setSelectedCategory] = useState('금융')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [view, setView] = useState('calendar')
  const [selectedRegion, setSelectedRegion] = useState('전체')

  useEffect(() => {
    fetchData(selectedCategory, selectedRegion)
  }, [selectedCategory, selectedRegion])

  const fetchData = async (category, region) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bizinfo?category=${encodeURIComponent(category)}&pageUnit=100`)
      const data = await res.json()
      let list = data?.jsonArray || []

      // 지원사업 캘린더는 키워드 필터 없이 전체
      if (region !== '전체') {
        list = list.filter(item => {
          const hashtags = item.hashtags || ''
          return hashtags.includes(region)
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

  const currentCat = CATEGORIES.find(c => c.key === selectedCategory)
  const color = currentCat?.color || '#0f3460'

  // 날짜별 공고 (예산소진 제외)
  const itemsByDay = {}
  const alwaysOnItems = []

  items.forEach(item => {
    if (isAlwaysOn(item)) {
      alwaysOnItems.push(item)
      return
    }
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
      {/* 카테고리 + 뷰 전환 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
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

      {/* 지역 필터 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {REGIONS.map(region => (
          <button key={region} onClick={() => { setSelectedRegion(region); setSelectedDay(null) }}
            style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: selectedRegion === region ? '#0f3460' : '#f0f0f0',
              color: selectedRegion === region ? 'white' : '#555',
            }}>
            {region}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>불러오는 중...</div>
      ) : view === 'calendar' ? (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* 캘린더 그리드 */}
          <div style={{ flex: '1 1 0', background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ background: color, color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setCurrentDate(new Date(year, month - 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{year}년 {month + 1}월 — {selectedCategory} 지원사업</span>
              <button onClick={() => setCurrentDate(new Date(year, month + 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f8f8' }}>
              {['일','월','화','수','목','금','토'].map((d, i) => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600, color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#666' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ height: 85 }} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayItems = itemsByDay[day] || []
                const isSelected = selectedDay === day
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
                return (
                  <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                    style={{
                      height: 85, overflow: 'hidden', padding: '6px 4px',
                      border: '1px solid #f0f0f0', cursor: 'pointer',
                      background: isSelected ? `${color}15` : 'white',
                      borderLeft: isSelected ? `3px solid ${color}` : '1px solid #f0f0f0',
                    }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? color : '#333', marginBottom: 2 }}>{day}</div>
                    {dayItems.slice(0, 2).map((item, idx) => (
                      <div key={idx} style={{
                        fontSize: 10, background: color, color: 'white',
                        borderRadius: 3, padding: '1px 4px', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.pblancNm || '공고'}
                      </div>
                    ))}
                    {dayItems.length > 2 && <div style={{ fontSize: 10, color: '#888' }}>+{dayItems.length - 2}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 오른쪽 공고 목록 */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            {/* 날짜별 마감 공고 */}
            {selectedDay ? (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 12, color: '#333', fontSize: 15 }}>
                  {month + 1}월 {selectedDay}일 마감 공고 ({selectedItems.length}건)
                </h3>
                {selectedItems.length > 0
                  ? selectedItems.map((item, i) => <AnnouncementCard key={i} item={item} color={color} getDday={getDday} />)
                  : <div style={{ color: '#aaa', fontSize: 13 }}>이 날 마감하는 공고가 없습니다.</div>
                }
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: '#aaa', background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 14 }}>날짜를 클릭하면<br />마감 공고를 확인할 수 있어요</div>
              </div>
            )}

            {/* 상시 진행중 — 항상 표시 */}
            {alwaysOnItems.length > 0 && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 10, paddingBottom: 8,
                  borderBottom: '1px dashed #e0e0e0'
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#555' }}>📌 상시 진행중</span>
                  <span style={{
                    fontSize: 11, background: '#f0fdf4', color: '#16a34a',
                    border: '1px solid #bbf7d0', borderRadius: 10, padding: '2px 8px'
                  }}>예산 소진 시 마감</span>
                  <span style={{ fontSize: 12, color: '#999' }}>({alwaysOnItems.length}건)</span>
                </div>
                {alwaysOnItems.map((item, i) => (
                  <AnnouncementCard key={i} item={item} color='#6b7280' getDday={getDday} alwaysOn />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>총 {items.length}건</div>
          {items.map((item, i) => <AnnouncementCard key={i} item={item} color={color} getDday={getDday} alwaysOn={isAlwaysOn(item)} />)}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────
// 공통 카드 컴포넌트
// ────────────────────────────────────────────
function AnnouncementCard({ item, color, getDday, alwaysOn }) {
  const title = item.pblancNm || item.pbanc_nm || item.pbancNm || item.title || '공고명 없음'
  const org = item.excInstt_nm || item.excInsttNm || item.organ || ''
  const startDate = item.pbancBgngDe || item.reqstBgngDe || ''
  const endDate = item.pbancEndDe || item.reqstEndDe || (item.reqstBeginEndDe ? item.reqstBeginEndDe.split('~')[1]?.trim() : '') || ''
  const dday = alwaysOn ? '상시' : getDday(endDate)
  const ddayColor = dday === '마감' ? '#aaa' : dday === 'D-Day' ? '#ef4444' : dday === '상시' ? '#16a34a' : parseInt(dday.replace('D-', '')) <= 7 ? '#ef4444' : color
  const link = item.pblancUrl || item.detailUrl || ''

  return (
    <div style={{
      background: 'white', borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      borderLeft: `4px solid ${alwaysOn ? '#9ca3af' : color}`,
      opacity: alwaysOn ? 0.92 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 4, lineHeight: 1.4 }}>{title}</div>
          {org && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{org}</div>}
          {alwaysOn
            ? <div style={{ fontSize: 12, color: '#16a34a' }}>📌 예산 소진 시까지 상시 접수</div>
            : (startDate || endDate) && <div style={{ fontSize: 12, color: '#aaa' }}>{startDate} ~ {endDate}</div>
          }
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

// ────────────────────────────────────────────
// 탭 래퍼 (기존 BizCalendar export 유지)
// ────────────────────────────────────────────
export default function BizCalendar() {
  const [calTab, setCalTab] = useState('policy')

  return (
    <div>
      {/* 캘린더 탭 전환 */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb',
        background: 'white', paddingLeft: 24,
      }}>
        {[
          { key: 'policy', label: '💰 정책자금 캘린더', desc: '이차보전·융자·보증 금융지원' },
          { key: 'support', label: '📋 지원사업 캘린더', desc: '전체 지원금 공고' },
        ].map(({ key, label, desc }) => (
          <button key={key} onClick={() => setCalTab(key)}
            style={{
              padding: '14px 28px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: calTab === key ? 700 : 400,
              color: calTab === key ? '#0f3460' : '#888',
              borderBottom: calTab === key ? '3px solid #0f3460' : '3px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}>
            {label}
            <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: calTab === key ? '#6b7280' : '#bbb', marginTop: 2 }}>{desc}</span>
          </button>
        ))}
      </div>

      {calTab === 'policy' ? <PolicyCalendar /> : <SupportCalendar />}
    </div>
  )
}
