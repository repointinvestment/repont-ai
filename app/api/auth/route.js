// 직원 계정 관리 (여기서 추가/삭제)
// 퇴사자 계정은 아래 목록에서 삭제하면 됩니다
const USERS = [
  { id: 'ceorepoint', pw: '!@#tnghks33', name: '관리자', role: 'ceo' },
  { id: 'repoint1', pw: '!flvhdlsxm33', name: '직원1', role: 'manager' },
  { id: 'repoint2', pw: '!flvhdlsxm33', name: '직원2', role: 'manager' },
]

export async function POST(req) {
  const { id, pw } = await req.json()
  const user = USERS.find(u => u.id === id && u.pw === pw)
  if (user) {
    return Response.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } })
  }
  return Response.json({ ok: false })
}
