export const metadata = {
  title: '자금비서',
  description: '정책자금 AI 컨설턴트',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  )
}
