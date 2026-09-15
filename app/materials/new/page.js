'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppHeader from '../../components/AppHeader'
import MaterialBuilder from '../../components/MaterialBuilder'

export default function NewMaterialPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    setUser(s)
  }, [])

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2' }}>
      <AppHeader user={user} />
      <MaterialBuilder user={user} />
    </div>
  )
}
