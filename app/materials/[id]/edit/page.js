'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../../components/AppHeader'
import MaterialBuilder from '../../../components/MaterialBuilder'

export default function EditMaterialPage() {
  const router = useRouter()
  const params = useParams()
  const [user, setUser] = useState(null)
  const [material, setMaterial] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
    fetch(`/api/materials/${params.id}`, { headers: { 'x-consultant-id': s.username, 'x-consultant-role': s.role } })
      .then((r) => r.json())
      .then((d) => {
        if (!d.material) { setError(d.error || '자료를 찾을 수 없습니다.'); return }
        setMaterial(d.material)
      })
  }, []);

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      {error ? (
        <p style={{ textAlign: 'center', color: '#C0392B', fontSize: 13, padding: 40 }}>{error}</p>
      ) : material ? (
        <MaterialBuilder user={user} initial={material} materialId={material.id} />
      ) : (
        <p style={{ textAlign: 'center', color: '#B0AEA5', fontSize: 13, padding: 40 }}>불러오는 중...</p>
      )}
    </div>
  )
}
