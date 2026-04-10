// auth/route.js의 USERS와 동일하게 유지
const USERS = [
  { id: 'ceorpoint', name: '관리자', role: 'admin' },
  { id: 'repoint1', name: '직원1', role: 'staff' },
  { id: 'repoint2', name: '직원2', role: 'staff' },
]

export async function GET() {
  const users = USERS.map(({ id, name, role }) => ({ id, name, role }))
  return Response.json({ users })
}
